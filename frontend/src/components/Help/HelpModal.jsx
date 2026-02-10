import React, { Fragment } from 'react'
import { Dialog, Transition, Tab } from '@headlessui/react'
import {
  XMarkIcon,
  BookOpenIcon,
  ScaleIcon,
  SparklesIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline'

function UsageTab({ data }) {
  if (!data) return null
  return (
    <div className="space-y-6">
      {data.sections?.map((section, i) => (
        <div key={i}>
          <h4 className="text-sm font-semibold text-gray-900 mb-1">{section.title}</h4>
          <p className="text-sm text-gray-600 leading-relaxed">{section.text}</p>
        </div>
      ))}

      {data.steps?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Pasos</h4>
          <ol className="space-y-2">
            {data.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-600">
                <span className="flex-shrink-0 w-6 h-6 bg-luci-light text-luci rounded-full flex items-center justify-center text-xs font-semibold">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function NormativaTab({ data }) {
  if (!data) return null
  return (
    <div className="space-y-3">
      {data.regulations?.map((reg, i) => (
        <div key={i} className="help-regulation-card">
          <div className="flex items-start justify-between gap-2">
            <span className="inline-block px-2 py-0.5 bg-luci-light text-luci text-xs font-semibold rounded">
              {reg.code}
            </span>
            {reg.url && (
              <a
                href={reg.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-luci hover:text-luci-dark flex-shrink-0"
                title="Ver normativa completa"
              >
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </a>
            )}
          </div>
          <h4 className="text-sm font-medium text-gray-900 mt-2">{reg.title}</h4>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{reg.description}</p>
        </div>
      ))}
    </div>
  )
}

function LuciIATab({ data }) {
  if (!data) return null
  return (
    <div className="space-y-4">
      {data.features?.map((feature, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-luci to-luci-dark rounded-lg flex items-center justify-center">
            <SparklesIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">{feature.name}</h4>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{feature.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

const tabConfig = [
  { key: 'uso', label: 'Como usar', Icon: BookOpenIcon, Component: UsageTab },
  { key: 'normativa', label: 'Normativa', Icon: ScaleIcon, Component: NormativaTab },
  { key: 'luciIA', label: 'LUCI IA', Icon: SparklesIcon, Component: LuciIATab }
]

export default function HelpModal({ isOpen, onClose, helpData }) {
  if (!helpData) return null

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="help-modal-overlay" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="help-modal-panel">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                      {helpData.title}
                    </Dialog.Title>
                    <p className="text-sm text-gray-500 mt-1">{helpData.description}</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Tabs */}
                <Tab.Group>
                  <Tab.List className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
                    {tabConfig.map(({ key, label, Icon }) => (
                      <Tab
                        key={key}
                        className={({ selected }) =>
                          `help-tab ${selected ? 'help-tab-active' : ''}`
                        }
                      >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                      </Tab>
                    ))}
                  </Tab.List>

                  <Tab.Panels>
                    {tabConfig.map(({ key, Component }) => (
                      <Tab.Panel key={key} className="max-h-[60vh] overflow-y-auto pr-1">
                        <Component data={helpData.tabs?.[key]} />
                      </Tab.Panel>
                    ))}
                  </Tab.Panels>
                </Tab.Group>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
