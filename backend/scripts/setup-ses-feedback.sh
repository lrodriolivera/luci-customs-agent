#!/usr/bin/env bash
#
# LUCI - Setup SES Feedback Loop (us-east-1)
# Creates: Configuration Set, 2 SNS topics (bounces + complaints),
# event destinations from SES → SNS, and HTTPS subscription to backend webhook.
#
# Prerequisites:
#   - AWS CLI configured with credentials for AgenteAduana (LUCI account 962990060849)
#   - Domain strixai.es verified in SES us-east-1
#   - Backend deployed at https://aduanas.strixai.es with /api/email/internal/ses-feedback
#
# Usage:
#   AWS_PROFILE=strixai bash scripts/setup-ses-feedback.sh
#
# Idempotent: safe to re-run.

set -euo pipefail

REGION="${SES_REGION:-us-east-1}"
CONFIG_SET="${SES_CONFIGURATION_SET:-luci-feedback-v1}"
WEBHOOK_URL="${SES_FEEDBACK_WEBHOOK:-https://aduanas.strixai.es/api/email/internal/ses-feedback}"
BOUNCE_TOPIC="luci-ses-bounces"
COMPLAINT_TOPIC="luci-ses-complaints"

PROFILE_ARG=""
[ -n "${AWS_PROFILE:-}" ] && PROFILE_ARG="--profile ${AWS_PROFILE}"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text $PROFILE_ARG)
echo "==> Account: $ACCOUNT_ID  Region: $REGION"

# 1. Configuration Set
if aws sesv2 get-configuration-set --configuration-set-name "$CONFIG_SET" --region "$REGION" $PROFILE_ARG >/dev/null 2>&1; then
  echo "==> Config set $CONFIG_SET already exists"
else
  aws sesv2 create-configuration-set --configuration-set-name "$CONFIG_SET" --region "$REGION" $PROFILE_ARG
  echo "==> Created config set $CONFIG_SET"
fi

# 2. SNS topics
create_topic () {
  local name="$1"
  local arn
  arn=$(aws sns create-topic --name "$name" --region "$REGION" $PROFILE_ARG --query TopicArn --output text)
  echo "$arn"
}
BOUNCE_ARN=$(create_topic "$BOUNCE_TOPIC")
COMPLAINT_ARN=$(create_topic "$COMPLAINT_TOPIC")
echo "==> Bounce topic:    $BOUNCE_ARN"
echo "==> Complaint topic: $COMPLAINT_ARN"

# 3. Allow SES to publish to topics
for ARN in "$BOUNCE_ARN" "$COMPLAINT_ARN"; do
  POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSESPublish",
      "Effect": "Allow",
      "Principal": {"Service": "ses.amazonaws.com"},
      "Action": "sns:Publish",
      "Resource": "$ARN",
      "Condition": {"StringEquals": {"AWS:SourceAccount": "$ACCOUNT_ID"}}
    }
  ]
}
EOF
)
  aws sns set-topic-attributes --topic-arn "$ARN" --attribute-name Policy --attribute-value "$POLICY" --region "$REGION" $PROFILE_ARG
done
echo "==> SNS access policies set"

# 4. Event destinations on Config Set
upsert_destination () {
  local name="$1" event_type="$2" topic_arn="$3"
  if aws sesv2 get-configuration-set-event-destinations --configuration-set-name "$CONFIG_SET" --region "$REGION" $PROFILE_ARG \
       --query "EventDestinations[?Name=='$name']" --output text | grep -q "$name"; then
    aws sesv2 update-configuration-set-event-destination \
      --configuration-set-name "$CONFIG_SET" \
      --event-destination-name "$name" \
      --event-destination "{\"Enabled\":true,\"MatchingEventTypes\":[\"$event_type\"],\"SnsDestination\":{\"TopicArn\":\"$topic_arn\"}}" \
      --region "$REGION" $PROFILE_ARG
    echo "==> Updated event destination $name"
  else
    aws sesv2 create-configuration-set-event-destination \
      --configuration-set-name "$CONFIG_SET" \
      --event-destination-name "$name" \
      --event-destination "{\"Enabled\":true,\"MatchingEventTypes\":[\"$event_type\"],\"SnsDestination\":{\"TopicArn\":\"$topic_arn\"}}" \
      --region "$REGION" $PROFILE_ARG
    echo "==> Created event destination $name"
  fi
}
upsert_destination "bounces"    "BOUNCE"    "$BOUNCE_ARN"
upsert_destination "complaints" "COMPLAINT" "$COMPLAINT_ARN"

# 5. HTTPS subscriptions to backend webhook
subscribe_https () {
  local topic_arn="$1"
  local existing
  existing=$(aws sns list-subscriptions-by-topic --topic-arn "$topic_arn" --region "$REGION" $PROFILE_ARG \
    --query "Subscriptions[?Endpoint=='$WEBHOOK_URL'].SubscriptionArn" --output text)
  if [ -n "$existing" ] && [ "$existing" != "None" ] && [ "$existing" != "PendingConfirmation" ]; then
    echo "==> Already subscribed: $existing"
    return
  fi
  aws sns subscribe --topic-arn "$topic_arn" --protocol https --notification-endpoint "$WEBHOOK_URL" \
    --region "$REGION" $PROFILE_ARG --query SubscriptionArn --output text
  echo "==> Subscription pending confirmation (backend will auto-confirm via webhook)"
}
echo "==> Subscribing $WEBHOOK_URL ..."
subscribe_https "$BOUNCE_ARN"
subscribe_https "$COMPLAINT_ARN"

cat <<EOF

================================================================
SES feedback loop ready.

  Configuration Set: $CONFIG_SET
  Bounces  → $BOUNCE_ARN
  Complaints → $COMPLAINT_ARN
  Webhook: $WEBHOOK_URL

Backend env vars to set on EC2:
  SES_CONFIGURATION_SET=$CONFIG_SET
  UNSUBSCRIBE_SECRET=<32+ random hex chars>
================================================================
EOF
