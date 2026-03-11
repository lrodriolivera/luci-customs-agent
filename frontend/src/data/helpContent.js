import i18n from '../i18n/i18n'

const t = (key) => i18n.t(key)

const getHelpContent = () => ({
  '/': {
    title: t('help.dashboard.title'),
    description: t('help.dashboard.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.dashboard.uso.s0Title'), text: t('help.dashboard.uso.s0Text') },
          { title: t('help.dashboard.uso.s1Title'), text: t('help.dashboard.uso.s1Text') }
        ],
        steps: [
          t('help.dashboard.uso.step0'),
          t('help.dashboard.uso.step1'),
          t('help.dashboard.uso.step2'),
          t('help.dashboard.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 5', title: t('help.dashboard.normativa.r0Title'), description: t('help.dashboard.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'RD 1073/2014', title: t('help.dashboard.normativa.r1Title'), description: t('help.dashboard.normativa.r1Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2014-13225' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.dashboard.luciIA.f0Name'), description: t('help.dashboard.luciIA.f0Desc') },
          { name: t('help.dashboard.luciIA.f1Name'), description: t('help.dashboard.luciIA.f1Desc') },
          { name: t('help.dashboard.luciIA.f2Name'), description: t('help.dashboard.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/expeditions': {
    title: t('help.expeditions.title'),
    description: t('help.expeditions.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.expeditions.uso.s0Title'), text: t('help.expeditions.uso.s0Text') },
          { title: t('help.expeditions.uso.s1Title'), text: t('help.expeditions.uso.s1Text') },
          { title: t('help.expeditions.uso.s2Title'), text: t('help.expeditions.uso.s2Text') }
        ],
        steps: [
          t('help.expeditions.uso.step0'),
          t('help.expeditions.uso.step1'),
          t('help.expeditions.uso.step2'),
          t('help.expeditions.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 158-187', title: t('help.expeditions.normativa.r0Title'), description: t('help.expeditions.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'CAU Art. 15', title: t('help.expeditions.normativa.r1Title'), description: t('help.expeditions.normativa.r1Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'AD Art. 143-152', title: t('help.expeditions.normativa.r2Title'), description: t('help.expeditions.normativa.r2Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2446' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.expeditions.luciIA.f0Name'), description: t('help.expeditions.luciIA.f0Desc') },
          { name: t('help.expeditions.luciIA.f1Name'), description: t('help.expeditions.luciIA.f1Desc') },
          { name: t('help.expeditions.luciIA.f2Name'), description: t('help.expeditions.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/channels': {
    title: t('help.channels.title'),
    description: t('help.channels.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.channels.uso.s0Title'), text: t('help.channels.uso.s0Text') },
          { title: t('help.channels.uso.s1Title'), text: t('help.channels.uso.s1Text') }
        ],
        steps: [
          t('help.channels.uso.step0'),
          t('help.channels.uso.step1'),
          t('help.channels.uso.step2'),
          t('help.channels.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 188-193', title: t('help.channels.normativa.r0Title'), description: t('help.channels.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'CAU Art. 46', title: t('help.channels.normativa.r1Title'), description: t('help.channels.normativa.r1Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.channels.luciIA.f0Name'), description: t('help.channels.luciIA.f0Desc') },
          { name: t('help.channels.luciIA.f1Name'), description: t('help.channels.luciIA.f1Desc') },
          { name: t('help.channels.luciIA.f2Name'), description: t('help.channels.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/requirements': {
    title: t('help.requirements.title'),
    description: t('help.requirements.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.requirements.uso.s0Title'), text: t('help.requirements.uso.s0Text') },
          { title: t('help.requirements.uso.s1Title'), text: t('help.requirements.uso.s1Text') }
        ],
        steps: [
          t('help.requirements.uso.step0'),
          t('help.requirements.uso.step1'),
          t('help.requirements.uso.step2'),
          t('help.requirements.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 188', title: t('help.requirements.normativa.r0Title'), description: t('help.requirements.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'LGT Art. 93', title: t('help.requirements.normativa.r1Title'), description: t('help.requirements.normativa.r1Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2003-23186' },
          { code: 'Ley 39/2015 Art. 68', title: t('help.requirements.normativa.r2Title'), description: t('help.requirements.normativa.r2Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-10565' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.requirements.luciIA.f0Name'), description: t('help.requirements.luciIA.f0Desc') },
          { name: t('help.requirements.luciIA.f1Name'), description: t('help.requirements.luciIA.f1Desc') },
          { name: t('help.requirements.luciIA.f2Name'), description: t('help.requirements.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/deadlines': {
    title: t('help.deadlines.title'),
    description: t('help.deadlines.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.deadlines.uso.s0Title'), text: t('help.deadlines.uso.s0Text') },
          { title: t('help.deadlines.uso.s1Title'), text: t('help.deadlines.uso.s1Text') }
        ],
        steps: [
          t('help.deadlines.uso.step0'),
          t('help.deadlines.uso.step1'),
          t('help.deadlines.uso.step2'),
          t('help.deadlines.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 108', title: t('help.deadlines.normativa.r0Title'), description: t('help.deadlines.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'CAU Art. 172', title: t('help.deadlines.normativa.r1Title'), description: t('help.deadlines.normativa.r1Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Ley 39/2015 Art. 21', title: t('help.deadlines.normativa.r2Title'), description: t('help.deadlines.normativa.r2Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-10565' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.deadlines.luciIA.f0Name'), description: t('help.deadlines.luciIA.f0Desc') },
          { name: t('help.deadlines.luciIA.f1Name'), description: t('help.deadlines.luciIA.f1Desc') },
          { name: t('help.deadlines.luciIA.f2Name'), description: t('help.deadlines.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/inspections': {
    title: t('help.inspections.title'),
    description: t('help.inspections.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.inspections.uso.s0Title'), text: t('help.inspections.uso.s0Text') },
          { title: t('help.inspections.uso.s1Title'), text: t('help.inspections.uso.s1Text') }
        ],
        steps: [
          t('help.inspections.uso.step0'),
          t('help.inspections.uso.step1'),
          t('help.inspections.uso.step2'),
          t('help.inspections.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 188-193', title: t('help.inspections.normativa.r0Title'), description: t('help.inspections.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'RD 1073/2014', title: t('help.inspections.normativa.r1Title'), description: t('help.inspections.normativa.r1Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2014-13225' },
          { code: 'CAU Art. 189', title: t('help.inspections.normativa.r2Title'), description: t('help.inspections.normativa.r2Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.inspections.luciIA.f0Name'), description: t('help.inspections.luciIA.f0Desc') },
          { name: t('help.inspections.luciIA.f1Name'), description: t('help.inspections.luciIA.f1Desc') },
          { name: t('help.inspections.luciIA.f2Name'), description: t('help.inspections.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/communications': {
    title: t('help.communications.title'),
    description: t('help.communications.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.communications.uso.s0Title'), text: t('help.communications.uso.s0Text') },
          { title: t('help.communications.uso.s1Title'), text: t('help.communications.uso.s1Text') }
        ],
        steps: [
          t('help.communications.uso.step0'),
          t('help.communications.uso.step1'),
          t('help.communications.uso.step2'),
          t('help.communications.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'Ley 39/2015 Art. 40-44', title: t('help.communications.normativa.r0Title'), description: t('help.communications.normativa.r0Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-10565' },
          { code: 'Ley 39/2015 Art. 14', title: t('help.communications.normativa.r1Title'), description: t('help.communications.normativa.r1Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-10565' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.communications.luciIA.f0Name'), description: t('help.communications.luciIA.f0Desc') },
          { name: t('help.communications.luciIA.f1Name'), description: t('help.communications.luciIA.f1Desc') },
          { name: t('help.communications.luciIA.f2Name'), description: t('help.communications.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/classification': {
    title: t('help.classification.title'),
    description: t('help.classification.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.classification.uso.s0Title'), text: t('help.classification.uso.s0Text') },
          { title: t('help.classification.uso.s1Title'), text: t('help.classification.uso.s1Text') },
          { title: t('help.classification.uso.s2Title'), text: t('help.classification.uso.s2Text') }
        ],
        steps: [
          t('help.classification.uso.step0'),
          t('help.classification.uso.step1'),
          t('help.classification.uso.step2'),
          t('help.classification.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 56-57', title: t('help.classification.normativa.r0Title'), description: t('help.classification.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'RGI 1-6', title: t('help.classification.normativa.r1Title'), description: t('help.classification.normativa.r1Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32019R1776' },
          { code: 'Reg. 2658/87', title: t('help.classification.normativa.r2Title'), description: t('help.classification.normativa.r2Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:31987R2658' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.classification.luciIA.f0Name'), description: t('help.classification.luciIA.f0Desc') },
          { name: t('help.classification.luciIA.f1Name'), description: t('help.classification.luciIA.f1Desc') },
          { name: t('help.classification.luciIA.f2Name'), description: t('help.classification.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/regulations': {
    title: t('help.regulations.title'),
    description: t('help.regulations.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.regulations.uso.s0Title'), text: t('help.regulations.uso.s0Text') },
          { title: t('help.regulations.uso.s1Title'), text: t('help.regulations.uso.s1Text') }
        ],
        steps: [
          t('help.regulations.uso.step0'),
          t('help.regulations.uso.step1'),
          t('help.regulations.uso.step2'),
          t('help.regulations.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'Reg. 952/2013', title: t('help.regulations.normativa.r0Title'), description: t('help.regulations.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Reg. 2015/2446', title: t('help.regulations.normativa.r1Title'), description: t('help.regulations.normativa.r1Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2446' },
          { code: 'Reg. 2015/2447', title: t('help.regulations.normativa.r2Title'), description: t('help.regulations.normativa.r2Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2447' },
          { code: 'RD 1073/2014', title: t('help.regulations.normativa.r3Title'), description: t('help.regulations.normativa.r3Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2014-13225' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.regulations.luciIA.f0Name'), description: t('help.regulations.luciIA.f0Desc') },
          { name: t('help.regulations.luciIA.f1Name'), description: t('help.regulations.luciIA.f1Desc') },
          { name: t('help.regulations.luciIA.f2Name'), description: t('help.regulations.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/declarations': {
    title: t('help.declarations.title'),
    description: t('help.declarations.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.declarations.uso.s0Title'), text: t('help.declarations.uso.s0Text') },
          { title: t('help.declarations.uso.s1Title'), text: t('help.declarations.uso.s1Text') },
          { title: t('help.declarations.uso.s2Title'), text: t('help.declarations.uso.s2Text') }
        ],
        steps: [
          t('help.declarations.uso.step0'),
          t('help.declarations.uso.step1'),
          t('help.declarations.uso.step2'),
          t('help.declarations.uso.step3'),
          t('help.declarations.uso.step4')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 158-187', title: t('help.declarations.normativa.r0Title'), description: t('help.declarations.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'AD Art. 143', title: t('help.declarations.normativa.r1Title'), description: t('help.declarations.normativa.r1Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2446' },
          { code: 'CAU Art. 70-74', title: t('help.declarations.normativa.r2Title'), description: t('help.declarations.normativa.r2Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.declarations.luciIA.f0Name'), description: t('help.declarations.luciIA.f0Desc') },
          { name: t('help.declarations.luciIA.f1Name'), description: t('help.declarations.luciIA.f1Desc') },
          { name: t('help.declarations.luciIA.f2Name'), description: t('help.declarations.luciIA.f2Desc') },
          { name: t('help.declarations.luciIA.f3Name'), description: t('help.declarations.luciIA.f3Desc') }
        ]
      }
    }
  },

  '/h7': {
    title: t('help.h7.title'),
    description: t('help.h7.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.h7.uso.s0Title'), text: t('help.h7.uso.s0Text') },
          { title: t('help.h7.uso.s1Title'), text: t('help.h7.uso.s1Text') }
        ],
        steps: [
          t('help.h7.uso.step0'),
          t('help.h7.uso.step1'),
          t('help.h7.uso.step2'),
          t('help.h7.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 143a', title: t('help.h7.normativa.r0Title'), description: t('help.h7.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Reg. 2019/1143', title: t('help.h7.normativa.r1Title'), description: t('help.h7.normativa.r1Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32019R1143' },
          { code: 'Dir. 2017/2455', title: t('help.h7.normativa.r2Title'), description: t('help.h7.normativa.r2Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32017L2455' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.h7.luciIA.f0Name'), description: t('help.h7.luciIA.f0Desc') },
          { name: t('help.h7.luciIA.f1Name'), description: t('help.h7.luciIA.f1Desc') },
          { name: t('help.h7.luciIA.f2Name'), description: t('help.h7.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/ens': {
    title: t('help.ens.title'),
    description: t('help.ens.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.ens.uso.s0Title'), text: t('help.ens.uso.s0Text') },
          { title: t('help.ens.uso.s1Title'), text: t('help.ens.uso.s1Text') }
        ],
        steps: [
          t('help.ens.uso.step0'),
          t('help.ens.uso.step1'),
          t('help.ens.uso.step2'),
          t('help.ens.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 127-130', title: t('help.ens.normativa.r0Title'), description: t('help.ens.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Reg. 2019/1010', title: t('help.ens.normativa.r1Title'), description: t('help.ens.normativa.r1Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32019R1010' },
          { code: 'CAU Art. 46-47', title: t('help.ens.normativa.r2Title'), description: t('help.ens.normativa.r2Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.ens.luciIA.f0Name'), description: t('help.ens.luciIA.f0Desc') },
          { name: t('help.ens.luciIA.f1Name'), description: t('help.ens.luciIA.f1Desc') },
          { name: t('help.ens.luciIA.f2Name'), description: t('help.ens.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/queries': {
    title: t('help.queries.title'),
    description: t('help.queries.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.queries.uso.s0Title'), text: t('help.queries.uso.s0Text') },
          { title: t('help.queries.uso.s1Title'), text: t('help.queries.uso.s1Text') }
        ],
        steps: [
          t('help.queries.uso.step0'),
          t('help.queries.uso.step1'),
          t('help.queries.uso.step2'),
          t('help.queries.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'RD 1065/2007', title: t('help.queries.normativa.r0Title'), description: t('help.queries.normativa.r0Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-15984' },
          { code: 'Ley 58/2003 Art. 95', title: t('help.queries.normativa.r1Title'), description: t('help.queries.normativa.r1Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2003-23186' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.queries.luciIA.f0Name'), description: t('help.queries.luciIA.f0Desc') },
          { name: t('help.queries.luciIA.f1Name'), description: t('help.queries.luciIA.f1Desc') },
          { name: t('help.queries.luciIA.f2Name'), description: t('help.queries.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/pue': {
    title: t('help.pue.title'),
    description: t('help.pue.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.pue.uso.s0Title'), text: t('help.pue.uso.s0Text') },
          { title: t('help.pue.uso.s1Title'), text: t('help.pue.uso.s1Text') }
        ],
        steps: [
          t('help.pue.uso.step0'),
          t('help.pue.uso.step1'),
          t('help.pue.uso.step2'),
          t('help.pue.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'RD 330/2008', title: t('help.pue.normativa.r0Title'), description: t('help.pue.normativa.r0Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2008-4680' },
          { code: 'Reg. 2019/1013', title: t('help.pue.normativa.r1Title'), description: t('help.pue.normativa.r1Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32019R1013' },
          { code: 'Reg. 2017/625', title: t('help.pue.normativa.r2Title'), description: t('help.pue.normativa.r2Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32017R0625' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.pue.luciIA.f0Name'), description: t('help.pue.luciIA.f0Desc') },
          { name: t('help.pue.luciIA.f1Name'), description: t('help.pue.luciIA.f1Desc') },
          { name: t('help.pue.luciIA.f2Name'), description: t('help.pue.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/guarantees': {
    title: t('help.guarantees.title'),
    description: t('help.guarantees.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.guarantees.uso.s0Title'), text: t('help.guarantees.uso.s0Text') },
          { title: t('help.guarantees.uso.s1Title'), text: t('help.guarantees.uso.s1Text') }
        ],
        steps: [
          t('help.guarantees.uso.step0'),
          t('help.guarantees.uso.step1'),
          t('help.guarantees.uso.step2'),
          t('help.guarantees.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 89-100', title: t('help.guarantees.normativa.r0Title'), description: t('help.guarantees.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'CAU Art. 95', title: t('help.guarantees.normativa.r1Title'), description: t('help.guarantees.normativa.r1Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'AD Art. 51-55', title: t('help.guarantees.normativa.r2Title'), description: t('help.guarantees.normativa.r2Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2446' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.guarantees.luciIA.f0Name'), description: t('help.guarantees.luciIA.f0Desc') },
          { name: t('help.guarantees.luciIA.f1Name'), description: t('help.guarantees.luciIA.f1Desc') },
          { name: t('help.guarantees.luciIA.f2Name'), description: t('help.guarantees.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/oea': {
    title: t('help.oea.title'),
    description: t('help.oea.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.oea.uso.s0Title'), text: t('help.oea.uso.s0Text') },
          { title: t('help.oea.uso.s1Title'), text: t('help.oea.uso.s1Text') }
        ],
        steps: [
          t('help.oea.uso.step0'),
          t('help.oea.uso.step1'),
          t('help.oea.uso.step2'),
          t('help.oea.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 38-39', title: t('help.oea.normativa.r0Title'), description: t('help.oea.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'AD Art. 24-30', title: t('help.oea.normativa.r1Title'), description: t('help.oea.normativa.r1Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2446' },
          { code: 'AE Art. 26-31', title: t('help.oea.normativa.r2Title'), description: t('help.oea.normativa.r2Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2447' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.oea.luciIA.f0Name'), description: t('help.oea.luciIA.f0Desc') },
          { name: t('help.oea.luciIA.f1Name'), description: t('help.oea.luciIA.f1Desc') },
          { name: t('help.oea.luciIA.f2Name'), description: t('help.oea.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/special-regimes': {
    title: t('help.specialRegimes.title'),
    description: t('help.specialRegimes.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.specialRegimes.uso.s0Title'), text: t('help.specialRegimes.uso.s0Text') },
          { title: t('help.specialRegimes.uso.s1Title'), text: t('help.specialRegimes.uso.s1Text') }
        ],
        steps: [
          t('help.specialRegimes.uso.step0'),
          t('help.specialRegimes.uso.step1'),
          t('help.specialRegimes.uso.step2'),
          t('help.specialRegimes.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 210-262', title: t('help.specialRegimes.normativa.r0Title'), description: t('help.specialRegimes.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'CAU Art. 211', title: t('help.specialRegimes.normativa.r1Title'), description: t('help.specialRegimes.normativa.r1Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'CAU Art. 255-258', title: t('help.specialRegimes.normativa.r2Title'), description: t('help.specialRegimes.normativa.r2Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.specialRegimes.luciIA.f0Name'), description: t('help.specialRegimes.luciIA.f0Desc') },
          { name: t('help.specialRegimes.luciIA.f1Name'), description: t('help.specialRegimes.luciIA.f1Desc') },
          { name: t('help.specialRegimes.luciIA.f2Name'), description: t('help.specialRegimes.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/transit': {
    title: t('help.transit.title'),
    description: t('help.transit.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.transit.uso.s0Title'), text: t('help.transit.uso.s0Text') },
          { title: t('help.transit.uso.s1Title'), text: t('help.transit.uso.s1Text') }
        ],
        steps: [
          t('help.transit.uso.step0'),
          t('help.transit.uso.step1'),
          t('help.transit.uso.step2'),
          t('help.transit.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 226-236', title: t('help.transit.normativa.r0Title'), description: t('help.transit.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Convenio TIR', title: t('help.transit.normativa.r1Title'), description: t('help.transit.normativa.r1Desc'), url: 'https://unece.org/tir-convention' },
          { code: 'Convenio de Transito Comun', title: t('help.transit.normativa.r2Title'), description: t('help.transit.normativa.r2Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:21987A0813(01)' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.transit.luciIA.f0Name'), description: t('help.transit.luciIA.f0Desc') },
          { name: t('help.transit.luciIA.f1Name'), description: t('help.transit.luciIA.f1Desc') },
          { name: t('help.transit.luciIA.f2Name'), description: t('help.transit.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/calculator': {
    title: t('help.calculator.title'),
    description: t('help.calculator.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.calculator.uso.s0Title'), text: t('help.calculator.uso.s0Text') },
          { title: t('help.calculator.uso.s1Title'), text: t('help.calculator.uso.s1Text') }
        ],
        steps: [
          t('help.calculator.uso.step0'),
          t('help.calculator.uso.step1'),
          t('help.calculator.uso.step2'),
          t('help.calculator.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 56', title: t('help.calculator.normativa.r0Title'), description: t('help.calculator.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Arancel Comun UE', title: t('help.calculator.normativa.r1Title'), description: t('help.calculator.normativa.r1Desc'), url: 'https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp?Lang=es' },
          { code: 'Ley 37/1992', title: t('help.calculator.normativa.r2Title'), description: t('help.calculator.normativa.r2Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.calculator.luciIA.f0Name'), description: t('help.calculator.luciIA.f0Desc') },
          { name: t('help.calculator.luciIA.f1Name'), description: t('help.calculator.luciIA.f1Desc') },
          { name: t('help.calculator.luciIA.f2Name'), description: t('help.calculator.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/rules-engine': {
    title: t('help.rulesEngine.title'),
    description: t('help.rulesEngine.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.rulesEngine.uso.s0Title'), text: t('help.rulesEngine.uso.s0Text') },
          { title: t('help.rulesEngine.uso.s1Title'), text: t('help.rulesEngine.uso.s1Text') }
        ],
        steps: [
          t('help.rulesEngine.uso.step0'),
          t('help.rulesEngine.uso.step1'),
          t('help.rulesEngine.uso.step2'),
          t('help.rulesEngine.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Titulo II', title: t('help.rulesEngine.normativa.r0Title'), description: t('help.rulesEngine.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'CAU Art. 46', title: t('help.rulesEngine.normativa.r1Title'), description: t('help.rulesEngine.normativa.r1Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.rulesEngine.luciIA.f0Name'), description: t('help.rulesEngine.luciIA.f0Desc') },
          { name: t('help.rulesEngine.luciIA.f1Name'), description: t('help.rulesEngine.luciIA.f1Desc') },
          { name: t('help.rulesEngine.luciIA.f2Name'), description: t('help.rulesEngine.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/preferences': {
    title: t('help.preferences.title'),
    description: t('help.preferences.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.preferences.uso.s0Title'), text: t('help.preferences.uso.s0Text') },
          { title: t('help.preferences.uso.s1Title'), text: t('help.preferences.uso.s1Text') }
        ],
        steps: [
          t('help.preferences.uso.step0'),
          t('help.preferences.uso.step1'),
          t('help.preferences.uso.step2'),
          t('help.preferences.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 56-65', title: t('help.preferences.normativa.r0Title'), description: t('help.preferences.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Protocolos de origen', title: t('help.preferences.normativa.r1Title'), description: t('help.preferences.normativa.r1Desc'), url: 'https://trade.ec.europa.eu/access-to-markets/es/content/acuerdos-comerciales-de-la-ue' },
          { code: 'Reg. 2015/2446 Art. 37-70', title: t('help.preferences.normativa.r2Title'), description: t('help.preferences.normativa.r2Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32015R2446' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.preferences.luciIA.f0Name'), description: t('help.preferences.luciIA.f0Desc') },
          { name: t('help.preferences.luciIA.f1Name'), description: t('help.preferences.luciIA.f1Desc') },
          { name: t('help.preferences.luciIA.f2Name'), description: t('help.preferences.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/excise-duties': {
    title: t('help.exciseDuties.title'),
    description: t('help.exciseDuties.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.exciseDuties.uso.s0Title'), text: t('help.exciseDuties.uso.s0Text') },
          { title: t('help.exciseDuties.uso.s1Title'), text: t('help.exciseDuties.uso.s1Text') }
        ],
        steps: [
          t('help.exciseDuties.uso.step0'),
          t('help.exciseDuties.uso.step1'),
          t('help.exciseDuties.uso.step2'),
          t('help.exciseDuties.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'Ley 38/1992', title: t('help.exciseDuties.normativa.r0Title'), description: t('help.exciseDuties.normativa.r0Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-28741' },
          { code: 'Dir. 2020/262', title: t('help.exciseDuties.normativa.r1Title'), description: t('help.exciseDuties.normativa.r1Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32020L0262' },
          { code: 'RD 1165/1995', title: t('help.exciseDuties.normativa.r2Title'), description: t('help.exciseDuties.normativa.r2Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1995-17661' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.exciseDuties.luciIA.f0Name'), description: t('help.exciseDuties.luciIA.f0Desc') },
          { name: t('help.exciseDuties.luciIA.f1Name'), description: t('help.exciseDuties.luciIA.f1Desc') },
          { name: t('help.exciseDuties.luciIA.f2Name'), description: t('help.exciseDuties.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/quotas': {
    title: t('help.quotas.title'),
    description: t('help.quotas.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.quotas.uso.s0Title'), text: t('help.quotas.uso.s0Text') },
          { title: t('help.quotas.uso.s1Title'), text: t('help.quotas.uso.s1Text') }
        ],
        steps: [
          t('help.quotas.uso.step0'),
          t('help.quotas.uso.step1'),
          t('help.quotas.uso.step2'),
          t('help.quotas.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU Art. 56(4)', title: t('help.quotas.normativa.r0Title'), description: t('help.quotas.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Reg. base contingentes', title: t('help.quotas.normativa.r1Title'), description: t('help.quotas.normativa.r1Desc'), url: 'https://ec.europa.eu/taxation_customs/dds2/taric/quota_consultation.jsp?Lang=es' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.quotas.luciIA.f0Name'), description: t('help.quotas.luciIA.f0Desc') },
          { name: t('help.quotas.luciIA.f1Name'), description: t('help.quotas.luciIA.f1Desc') },
          { name: t('help.quotas.luciIA.f2Name'), description: t('help.quotas.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/integrations': {
    title: t('help.integrations.title'),
    description: t('help.integrations.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.integrations.uso.s0Title'), text: t('help.integrations.uso.s0Text') },
          { title: t('help.integrations.uso.s1Title'), text: t('help.integrations.uso.s1Text') }
        ],
        steps: [
          t('help.integrations.uso.step0'),
          t('help.integrations.uso.step1'),
          t('help.integrations.uso.step2'),
          t('help.integrations.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'Normativa AEAT', title: t('help.integrations.normativa.r0Title'), description: t('help.integrations.normativa.r0Desc'), url: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/disenos-registro.html' },
          { code: 'Reg. 2019/1010', title: t('help.integrations.normativa.r1Title'), description: t('help.integrations.normativa.r1Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32019R1010' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.integrations.luciIA.f0Name'), description: t('help.integrations.luciIA.f0Desc') },
          { name: t('help.integrations.luciIA.f1Name'), description: t('help.integrations.luciIA.f1Desc') },
          { name: t('help.integrations.luciIA.f2Name'), description: t('help.integrations.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/aeat/certificates': {
    title: t('help.aeatCertificates.title'),
    description: t('help.aeatCertificates.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.aeatCertificates.uso.s0Title'), text: t('help.aeatCertificates.uso.s0Text') },
          { title: t('help.aeatCertificates.uso.s1Title'), text: t('help.aeatCertificates.uso.s1Text') }
        ],
        steps: [
          t('help.aeatCertificates.uso.step0'),
          t('help.aeatCertificates.uso.step1'),
          t('help.aeatCertificates.uso.step2'),
          t('help.aeatCertificates.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'RD 1065/2007', title: t('help.aeatCertificates.normativa.r0Title'), description: t('help.aeatCertificates.normativa.r0Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2007-15984' },
          { code: 'Ley 6/2020', title: t('help.aeatCertificates.normativa.r1Title'), description: t('help.aeatCertificates.normativa.r1Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2020-14046' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.aeatCertificates.luciIA.f0Name'), description: t('help.aeatCertificates.luciIA.f0Desc') },
          { name: t('help.aeatCertificates.luciIA.f1Name'), description: t('help.aeatCertificates.luciIA.f1Desc') },
          { name: t('help.aeatCertificates.luciIA.f2Name'), description: t('help.aeatCertificates.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/aeat/monitor': {
    title: t('help.aeatMonitor.title'),
    description: t('help.aeatMonitor.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.aeatMonitor.uso.s0Title'), text: t('help.aeatMonitor.uso.s0Text') },
          { title: t('help.aeatMonitor.uso.s1Title'), text: t('help.aeatMonitor.uso.s1Text') }
        ],
        steps: [
          t('help.aeatMonitor.uso.step0'),
          t('help.aeatMonitor.uso.step1'),
          t('help.aeatMonitor.uso.step2'),
          t('help.aeatMonitor.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'Disponibilidad AEAT', title: t('help.aeatMonitor.normativa.r0Title'), description: t('help.aeatMonitor.normativa.r0Desc'), url: 'https://sede.agenciatributaria.gob.es/' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.aeatMonitor.luciIA.f0Name'), description: t('help.aeatMonitor.luciIA.f0Desc') },
          { name: t('help.aeatMonitor.luciIA.f1Name'), description: t('help.aeatMonitor.luciIA.f1Desc') },
          { name: t('help.aeatMonitor.luciIA.f2Name'), description: t('help.aeatMonitor.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/analytics': {
    title: t('help.analytics.title'),
    description: t('help.analytics.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.analytics.uso.s0Title'), text: t('help.analytics.uso.s0Text') },
          { title: t('help.analytics.uso.s1Title'), text: t('help.analytics.uso.s1Text') }
        ],
        steps: [
          t('help.analytics.uso.step0'),
          t('help.analytics.uso.step1'),
          t('help.analytics.uso.step2'),
          t('help.analytics.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'Normativa interna', title: t('help.analytics.normativa.r0Title'), description: t('help.analytics.normativa.r0Desc') }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.analytics.luciIA.f0Name'), description: t('help.analytics.luciIA.f0Desc') },
          { name: t('help.analytics.luciIA.f1Name'), description: t('help.analytics.luciIA.f1Desc') },
          { name: t('help.analytics.luciIA.f2Name'), description: t('help.analytics.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/settings': {
    title: t('help.settings.title'),
    description: t('help.settings.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.settings.uso.s0Title'), text: t('help.settings.uso.s0Text') },
          { title: t('help.settings.uso.s1Title'), text: t('help.settings.uso.s1Text') },
          { title: t('help.settings.uso.s2Title'), text: t('help.settings.uso.s2Text') }
        ],
        steps: [
          t('help.settings.uso.step0'),
          t('help.settings.uso.step1'),
          t('help.settings.uso.step2'),
          t('help.settings.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'RGPD', title: t('help.settings.normativa.r0Title'), description: t('help.settings.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32016R0679' },
          { code: 'ENS', title: t('help.settings.normativa.r1Title'), description: t('help.settings.normativa.r1Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2022-7191' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.settings.luciIA.f0Name'), description: t('help.settings.luciIA.f0Desc') },
          { name: t('help.settings.luciIA.f1Name'), description: t('help.settings.luciIA.f1Desc') }
        ]
      }
    }
  },

  '/billing': {
    title: t('help.billing.title'),
    description: t('help.billing.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.billing.uso.s0Title'), text: t('help.billing.uso.s0Text') },
          { title: t('help.billing.uso.s1Title'), text: t('help.billing.uso.s1Text') }
        ],
        steps: [
          t('help.billing.uso.step0'),
          t('help.billing.uso.step1'),
          t('help.billing.uso.step2'),
          t('help.billing.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'RD 1619/2012', title: t('help.billing.normativa.r0Title'), description: t('help.billing.normativa.r0Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2012-14696' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.billing.luciIA.f0Name'), description: t('help.billing.luciIA.f0Desc') },
          { name: t('help.billing.luciIA.f1Name'), description: t('help.billing.luciIA.f1Desc') }
        ]
      }
    }
  },

  '/admin': {
    title: t('help.admin.title'),
    description: t('help.admin.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.admin.uso.s0Title'), text: t('help.admin.uso.s0Text') },
          { title: t('help.admin.uso.s1Title'), text: t('help.admin.uso.s1Text') },
          { title: t('help.admin.uso.s2Title'), text: t('help.admin.uso.s2Text') }
        ],
        steps: [
          t('help.admin.uso.step0'),
          t('help.admin.uso.step1'),
          t('help.admin.uso.step2'),
          t('help.admin.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'RGPD', title: t('help.admin.normativa.r0Title'), description: t('help.admin.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32016R0679' },
          { code: 'ENS', title: t('help.admin.normativa.r1Title'), description: t('help.admin.normativa.r1Desc'), url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2022-7191' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.admin.luciIA.f0Name'), description: t('help.admin.luciIA.f0Desc') },
          { name: t('help.admin.luciIA.f1Name'), description: t('help.admin.luciIA.f1Desc') },
          { name: t('help.admin.luciIA.f2Name'), description: t('help.admin.luciIA.f2Desc') }
        ]
      }
    }
  },

  '/ml-insights': {
    title: t('help.mlInsights.title'),
    description: t('help.mlInsights.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.mlInsights.uso.s0Title'), text: t('help.mlInsights.uso.s0Text') },
          { title: t('help.mlInsights.uso.s1Title'), text: t('help.mlInsights.uso.s1Text') }
        ],
        steps: [
          t('help.mlInsights.uso.step0'),
          t('help.mlInsights.uso.step1'),
          t('help.mlInsights.uso.step2'),
          t('help.mlInsights.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'Reg. IA UE 2024/1689', title: t('help.mlInsights.normativa.r0Title'), description: t('help.mlInsights.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32024R1689' },
          { code: 'RGPD Art. 22', title: t('help.mlInsights.normativa.r1Title'), description: t('help.mlInsights.normativa.r1Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32016R0679' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.mlInsights.luciIA.f0Name'), description: t('help.mlInsights.luciIA.f0Desc') },
          { name: t('help.mlInsights.luciIA.f1Name'), description: t('help.mlInsights.luciIA.f1Desc') },
          { name: t('help.mlInsights.luciIA.f2Name'), description: t('help.mlInsights.luciIA.f2Desc') },
          { name: t('help.mlInsights.luciIA.f3Name'), description: t('help.mlInsights.luciIA.f3Desc') }
        ]
      }
    }
  },

  '/assistant': {
    title: t('help.assistant.title'),
    description: t('help.assistant.description'),
    tabs: {
      uso: {
        sections: [
          { title: t('help.assistant.uso.s0Title'), text: t('help.assistant.uso.s0Text') },
          { title: t('help.assistant.uso.s1Title'), text: t('help.assistant.uso.s1Text') }
        ],
        steps: [
          t('help.assistant.uso.step0'),
          t('help.assistant.uso.step1'),
          t('help.assistant.uso.step2'),
          t('help.assistant.uso.step3')
        ]
      },
      normativa: {
        regulations: [
          { code: 'CAU completo', title: t('help.assistant.normativa.r0Title'), description: t('help.assistant.normativa.r0Desc'), url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32013R0952' },
          { code: 'Legislacion nacional', title: t('help.assistant.normativa.r1Title'), description: t('help.assistant.normativa.r1Desc'), url: 'https://www.boe.es/' }
        ]
      },
      luciIA: {
        features: [
          { name: t('help.assistant.luciIA.f0Name'), description: t('help.assistant.luciIA.f0Desc') },
          { name: t('help.assistant.luciIA.f1Name'), description: t('help.assistant.luciIA.f1Desc') },
          { name: t('help.assistant.luciIA.f2Name'), description: t('help.assistant.luciIA.f2Desc') },
          { name: t('help.assistant.luciIA.f3Name'), description: t('help.assistant.luciIA.f3Desc') }
        ]
      }
    }
  }
})

export default getHelpContent
