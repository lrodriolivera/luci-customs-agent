/**
 * UCC Data Mapper - Maps LUCI expedition data to EU Customs Data Model elements
 * These are common across ALL EU member states (Annex B UCC)
 */
class UCCDataMapper {

  /**
   * Map expedition to H7 super-reduced dataset (common EU format)
   * Column H7 of Annex B UCC - identical across all member states
   */
  static expeditionToH7(expedition) {
    const goods = expedition.goods || [];

    return {
      // Declaration header
      declarationType: 'IM',
      additionalDeclarationType: 'C', // H7 simplified

      // Parties
      declarant: {
        eori: expedition.declarant?.eori || expedition.client?.taxId,
        name: expedition.declarant?.companyName || expedition.client?.companyName,
      },
      exporter: {
        name: expedition.exporter?.companyName,
        address: expedition.exporter?.address,
        country: expedition.exporter?.country,
      },
      importer: {
        eori: expedition.importer?.eori || expedition.client?.taxId,
        name: expedition.importer?.companyName || expedition.client?.companyName,
      },

      // Goods items
      items: goods.map((item, idx) => ({
        itemNumber: idx + 1,
        commodityCode: (item.taricCode || item.hsCode || '').substring(0, 6), // 6 digits for H7
        description: item.description,
        grossMass: item.grossWeight || item.weight,
        netMass: item.netWeight,
        customsValue: item.invoiceValue || item.value,
        currency: item.currency || expedition.currency || 'EUR',
        countryOfOrigin: item.countryOfOrigin || expedition.exporter?.country,
        numberOfPackages: item.packageCount || item.quantity || 1,
        packageType: item.packageType || 'CT', // CT = carton
      })),

      // Transport
      transport: {
        mode: UCCDataMapper.mapTransportMode(expedition.transportMode),
        documentType: expedition.transport?.documentType,
        documentRef: expedition.transport?.documentRef || expedition.transport?.billOfLading,
      },

      // Values
      totalCustomsValue: expedition.calculations?.customsValue || expedition.calculations?.invoiceTotal,
      totalGrossMass: goods.reduce((sum, g) => sum + (g.grossWeight || g.weight || 0), 0),
      totalPackages: goods.reduce((sum, g) => sum + (g.packageCount || g.quantity || 1), 0),
      currency: expedition.currency || 'EUR',

      // IOSS (e-commerce)
      iossNumber: expedition.iossNumber || null,

      // Reference
      uniqueConsignmentRef: expedition.expeditionId,
      localReferenceNumber: expedition.expeditionId,
    };
  }

  /**
   * Map expedition to H1 full dataset
   */
  static expeditionToH1(expedition) {
    const h7Data = UCCDataMapper.expeditionToH7(expedition);

    return {
      ...h7Data,
      additionalDeclarationType: 'A', // H1 standard

      // Additional H1-specific fields
      customsOffice: expedition.transport?.entryCustomsOffice,
      countryOfDispatch: expedition.exporter?.country,
      countryOfDestination: expedition.importer?.country || 'ES',

      // Detailed goods with 10-digit TARIC
      items: (expedition.goods || []).map((item, idx) => ({
        ...h7Data.items[idx],
        commodityCode: item.taricCode || item.hsCode, // Full 10-digit for H1
        dutyRate: item.dutyRate,
        vatRate: item.vatRate,
        dutyAmount: item.dutyAmount,
        vatAmount: item.vatAmount,
        preferentialOrigin: item.preferentialOrigin,
        quota: item.quota,
        additionalCodes: item.additionalCodes || [],
        documents: item.documents || [],
      })),

      // Guarantees
      guarantee: expedition.guarantee,

      // Previous documents
      previousDocuments: expedition.previousDocuments || [],
    };
  }

  /**
   * Map transport mode to UCC code
   */
  static mapTransportMode(mode) {
    const modeMap = {
      'maritime': '1',
      'rail': '2',
      'road': '3',
      'air': '4',
      'postal': '5',
      'multimodal': '7',
      'inland_waterway': '8',
    };
    return modeMap[mode] || '3'; // Default road
  }

  /**
   * Validate H7 data completeness
   */
  static validateH7(data) {
    const errors = [];

    if (!data.declarant?.eori) errors.push('Declarant EORI required');
    if (!data.items || data.items.length === 0) errors.push('At least one goods item required');

    data.items?.forEach((item, idx) => {
      if (!item.commodityCode) errors.push(`Item ${idx + 1}: Commodity code required`);
      if (!item.customsValue) errors.push(`Item ${idx + 1}: Customs value required`);
      if (!item.description) errors.push(`Item ${idx + 1}: Description required`);
      if (item.customsValue > 150) errors.push(`Item ${idx + 1}: H7 max value is 150 EUR`);
    });

    if (!data.transport?.documentRef) errors.push('Transport document reference required');

    return { valid: errors.length === 0, errors };
  }
}

module.exports = UCCDataMapper;
