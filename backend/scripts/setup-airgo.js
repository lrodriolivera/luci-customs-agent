require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Tenant = require('../src/models/Tenant');

async function setup() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/luci-customs');

  // Create AIRGO tenant
  let tenant = await Tenant.findOne({ 'businessInfo.nif': 'B84285923' });
  if (!tenant) {
    tenant = await Tenant.create({
      name: 'AIRGO EXPRESS',
      slug: 'airgo-express',
      status: 'trial',
      businessInfo: {
        type: 'customs_agent',
        nif: 'B84285923',
        eori: 'ESB84285923',
        address: { street: '', city: 'Madrid', postalCode: '28000', country: 'ES' }
      },
      subscription: { plan: 'business', status: 'trialing' },
      customsConfig: {
        country: 'ES',
        system: 'AEAT',
        environment: 'test'
      },
      limits: { maxUsers: 20, maxDeclarations: 200 }
    });
    console.log('Tenant created:', tenant._id);
  } else {
    console.log('Tenant exists:', tenant._id);
  }

  // Create users
  const users = [
    { email: 'bvillanueva@airgoexpress.com', firstName: 'Borja', lastName: 'Villanueva', role: 'admin' },
    { email: 'jsendarrubias@airgoexpress.com', firstName: 'J', lastName: 'Sendarrubias', role: 'agent' },
    { email: 'marcomula@airgoexpress.com', firstName: 'Marco', lastName: 'Mula', role: 'agent' },
    { email: 'mquintana@airgoexpress.com', firstName: 'Manel', lastName: 'Quintana', role: 'admin' },
    { email: 'aarriaga@airgoexpress.com', firstName: 'A', lastName: 'Arriaga', role: 'agent' },
  ];

  for (const u of users) {
    const exists = await User.findOne({ email: u.email });
    if (!exists) {
      await new User({
        email: u.email,
        password: 'AirgoDemo2026',
        name: u.firstName + ' ' + u.lastName,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        tenantId: tenant._id,
        organizationId: tenant._id,
        isActive: true,
        profile: { company: 'AIRGO EXPRESS' }
      }).save();
      console.log('  Created:', u.email);
    } else {
      console.log('  Exists:', u.email);
    }
  }

  console.log('\n========================================');
  console.log('AIRGO EXPRESS ready!');
  console.log('Tenant ID:', tenant._id.toString());
  console.log('URL: https://aduanas.strixai.es');
  console.log('Login: any email above / AirgoDemo2026');
  console.log('========================================');
  await mongoose.disconnect();
}

setup().catch(e => { console.error(e); process.exit(1); });
