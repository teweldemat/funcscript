{
    ReportUtilStub: () => {
        normalize: (value) => if(value = null, 0, value);
        return {
            MoneyToDouble: (value) => normalize(value);
            DoubleToMoney: (value) => normalize(value);
            ToMoneyString: (value) => "ETB " + normalize(value);
            ToTransactionTypeString: (value) => if(value = null, "Unknown", value);
        };
    };

    DetailByLabel: (result, label) => {
        matches: result.BillDetails filter (d) => d.Label = label;
        return if(len(matches) = 0, null, matches[0]);
    };

    CodeCount: (items, code) => len(items filter (b) => b.Code = code);

    giftSuite: {
        name: "Gift Bill Composition";
        cases: [
            {
                scenario: "Gift Biz To Biz";
                landValue: 500000;
                buildingValue: 200000;
                expectedBuildingValue: 200000;
                expectedMarketValue: 700000;
                transferorRecord: {
                    LandRecord: { Id: 101; Uic: "TR-UIC-101" };
                    Owners: [
                        { PartyType: "BusinessEntity" }
                    ];
                    PropertyData: { Floors: 1 };
                    FixedPropertyValue: {
                        Value: buildingValue;
                        EvaluatedBy: "Assessor";
                        EvaluatedOn: 0;
                    };
                };
                expectedFirstItem: "ashura-business-or-individual-to-business";
                expectedLandUse: "Mixed Use";
                billRecord: {
                    LandRecord: { Id: 202; Uic: "BL-UIC-202" };
                };
                expectedItemCount: 6;
                report_util: ReportUtilStub();
                cis_core: {
                    GetLevel1LandRecord: (id) => if(id = transferorRecord.LandRecord.Id, transferorRecord, billRecord);
                    GetCodedTextById: (id) => switch id,
                        300: { Text: "Mixed Use" },
                        { Text: "Unknown" };
                    GetLandValue: (_) => landValue;
                    GetTotalBuildingValue: (_) => buildingValue;
                };
                cis: { GeomArea: (_) => 0 };
                wfState: {
                    Transfer: {
                        TranferorLandRecordId: transferorRecord.LandRecord.Id;
                        Type: "Gift";
                        SaleAmount: 0;
                        PrevSaleValue: null;
                    };
                    TransferTarget: {
                        OwnersString: "Biz Target";
                        Owners: [
                            { PartyType: "BusinessEntity" }
                        ];
                        LandRecord: { LandUseTypeId: 300 };
                        HousingUnit: { TotalFloorArea: 120 };
                    };
                    NewTitleDeeds: [ { Id: 1 }, { Id: 2 } ];
                    SpatialTasks: [];
                };
                landRecordId: billRecord.LandRecord.Id;
            },
            {
                scenario: "Gift uses fixed value when no property data";
                landValue: 350000;
                buildingValue: 120000;
                expectedBuildingValue: 120000;
                expectedMarketValue: 470000;
                transferorRecord: {
                    LandRecord: { Id: 151; Uic: "TR-UIC-151" };
                    Owners: [
                        { PartyType: "Individual" }
                    ];
                    PropertyData: null;
                    FixedPropertyValue: {
                        Value: buildingValue;
                        EvaluatedBy: "Assessor";
                        EvaluatedOn: 0;
                    };
                };
                billRecord: {
                    LandRecord: { Id: 212; Uic: "BL-UIC-212" };
                };
                expectedFirstItem: "ashura-sale-gift";
                expectedLandUse: "Residential";
                expectedItemCount: 5;
                report_util: ReportUtilStub();
                cis_core: {
                    GetLevel1LandRecord: (id) => if(id = transferorRecord.LandRecord.Id, transferorRecord, billRecord);
                    GetCodedTextById: (id) => switch id,
                        305: { Text: "Residential" },
                        { Text: "Unknown" };
                    GetLandValue: (_) => landValue;
                    GetTotalBuildingValue: (_) => buildingValue;
                };
                cis: { GeomArea: (_) => 0 };
                wfState: {
                    Transfer: {
                        TranferorLandRecordId: transferorRecord.LandRecord.Id;
                        Type: "Gift";
                        SaleAmount: 0;
                        PrevSaleValue: null;
                    };
                    TransferTarget: {
                        OwnersString: "Fixed Target";
                        Owners: [
                            { PartyType: "Individual" }
                        ];
                        LandRecord: { LandUseTypeId: 305 };
                        HousingUnit: { TotalFloorArea: 85 };
                    };
                    NewTitleDeeds: [ { Id: 7 } ];
                    SpatialTasks: [];
                };
                landRecordId: billRecord.LandRecord.Id;
            }
        ];
        test: (result, data) => {
            uicDetail: DetailByLabel(result, "UIC");
            landValueDetail: DetailByLabel(result, "Land Value");
            buildingValueDetail: DetailByLabel(result, "Building Value");
            marketValueDetail: DetailByLabel(result, "Market Value");
            landUseDetail: DetailByLabel(result, "Land Use");

            return [
                result.Narrative = "Land Transfer Fee",
                len(result.BillItemDefs) = data.expectedItemCount,
                result.BillItemDefs[0].Code = data.expectedFirstItem,
                CodeCount(result.BillItemDefs, "title-deed-fee") = len(data.wfState.NewTitleDeeds),
                CodeCount(result.BillItemDefs, "contract-registration") = 1,
                CodeCount(result.BillItemDefs, "verification-service") = 1,
                CodeCount(result.BillItemDefs, "property-valuation") = 1,
                uicDetail.Value = data.billRecord.LandRecord.Uic,
                landUseDetail.Value = data.expectedLandUse,
                landValueDetail.Value = "ETB " + data.landValue,
                buildingValueDetail.Value = "ETB " + data.expectedBuildingValue,
                marketValueDetail.Value = "ETB " + data.expectedMarketValue,
                result.BillItemDefs[0].Args.MarketValue = data.expectedMarketValue,
                len(result.BillDetails) = 7
            ];
        }
    };

    associationSuite: {
        name: "FromAssociation exclusions";
        cases: [
            {
                scenario: "Association avoids ashura sale gift";
                landValue: 250000;
                buildingValue: 75000;
                expectedBuildingValue: 75000;
                transferorRecord: {
                    LandRecord: { Id: 303; Uic: "TR-UIC-303" };
                    Owners: [
                        { PartyType: "Individual" }
                    ];
                    PropertyData: { Floors: 2 };
                };
                billRecord: {
                    LandRecord: { Id: 404; Uic: "BL-UIC-404" };
                };
                report_util: ReportUtilStub();
                cis_core: {
                    GetLevel1LandRecord: (id) => if(id = transferorRecord.LandRecord.Id, transferorRecord, billRecord);
                    GetCodedTextById: (id) => switch id,
                        301: { Text: "Association Land Use" },
                        { Text: "Unknown" };
                    GetLandValue: (_) => landValue;
                    GetTotalBuildingValue: (_) => buildingValue;
                };
                cis: { GeomArea: (_) => 0 };
                wfState: {
                    Transfer: {
                        TranferorLandRecordId: transferorRecord.LandRecord.Id;
                        Type: "FromAssociation";
                        SaleAmount: 0;
                        PrevSaleValue: null;
                    };
                    TransferTarget: {
                        OwnersString: "Association";
                        Owners: [
                            { PartyType: "GovernmentEntity" }
                        ];
                        LandRecord: { LandUseTypeId: 301 };
                    };
                    NewTitleDeeds: [ { Id: 9 } ];
                    SpatialTasks: [];
                };
                landRecordId: billRecord.LandRecord.Id;
            }
        ];
        test: (result, data) => {
            landValueDetail: DetailByLabel(result, "Land Value");
            marketValueDetail: DetailByLabel(result, "Market Value");
            buildingValueDetail: DetailByLabel(result, "Building Value");
            uicDetail: DetailByLabel(result, "UIC");

            return [
                result.Narrative = "Land Transfer Fee",
                len(result.BillItemDefs) = 4,
                result.BillItemDefs[0].Code = "title-deed-fee",
                CodeCount(result.BillItemDefs, "ashura-sale-gift") = 0,
                CodeCount(result.BillItemDefs, "contract-registration") = 1,
                CodeCount(result.BillItemDefs, "verification-service") = 1,
                CodeCount(result.BillItemDefs, "property-valuation") = 1,
                len(result.BillDetails) = 5,
                landValueDetail = null,
                marketValueDetail = null,
                buildingValueDetail.Value = "ETB " + data.expectedBuildingValue,
                uicDetail.Value = data.billRecord.LandRecord.Uic
            ];
        }
    };

    saleSuite: {
        name: "Sale and spatial flow";
        cases: [
            {
                scenario: "Sale picks highest amount and adds land area";
                landValue: 400000;
                buildingValue: 150000;
                expectedBuildingValue: 0;
                saleAmount: 650000;
                prevSaleValue: 350000;
                expectedLandArea: Format(20, "#,#.0");
                transferorRecord: {
                    LandRecord: { Id: 707; Uic: "TR-UIC-707" };
                    Owners: [
                        { PartyType: "BusinessEntity" },
                        { PartyType: "GovernmentEntity" }
                    ];
                    PropertyData: { Floors: 5 };
                    FixedPropertyValue: {
                        Value: buildingValue;
                        EvaluatedBy: "Assessor";
                        EvaluatedOn: 0;
                    };
                };
                billRecord: {
                    LandRecord: { Id: 808; Uic: "BL-UIC-808" };
                };
                report_util: ReportUtilStub();
                cis_core: {
                    GetLevel1LandRecord: (id) => if(id = transferorRecord.LandRecord.Id, transferorRecord, billRecord);
                    GetCodedTextById: (id) => switch id,
                        302: { Text: "Residential" },
                        { Text: "Unknown" };
                    GetLandValue: (_) => landValue;
                    GetTotalBuildingValue: (_) => buildingValue;
                };
                cis: {
                    GeomArea: (wkt) => switch wkt,
                        "poly-a": 10,
                        "poly-b": 7.5,
                        "poly-c": 2.5,
                        0;
                };
                wfState: {
                    Transfer: {
                        TranferorLandRecordId: transferorRecord.LandRecord.Id;
                        Type: "Sale";
                        SaleAmount: saleAmount;
                        PrevSaleValue: prevSaleValue;
                    };
                    TransferTarget: {
                        OwnersString: "New Holder";
                        Owners: [
                            { PartyType: "Individual" }
                        ];
                        LandRecord: { LandUseTypeId: 302 };
                    };
                    NewTitleDeeds: [ { Id: 5 } ];
                    SpatialTasks: [
                        { Target: [ { Wkt: "poly-a" }, { Wkt: "poly-b" } ] },
                        { Target: [ { Wkt: "poly-c" } ] }
                    ];
                };
                landRecordId: null;
            }
        ];
        test: (result, data) => {
            landValueDetail: DetailByLabel(result, "Land Value");
            buildingValueDetail: DetailByLabel(result, "Building Value");
            marketValueDetail: DetailByLabel(result, "Market Value");
            saleAmountDetail: DetailByLabel(result, "Sale Amount");
            saleValueDetail: DetailByLabel(result, "Sale Value");
            prevSaleDetail: DetailByLabel(result, "Previous Sale Value");
            landAreaDetail: DetailByLabel(result, "Land Area");
            uicDetail: DetailByLabel(result, "UIC");

            return [
                result.Narrative = "Land Transfer Fee",
                len(result.BillItemDefs) = 4,
                result.BillItemDefs[0].Code = "ashura-business-to-business-or-individual",
                CodeCount(result.BillItemDefs, "title-deed-fee") = len(data.wfState.NewTitleDeeds),
                CodeCount(result.BillItemDefs, "contract-registration") = 1,
                CodeCount(result.BillItemDefs, "verification-service") = 1,
                CodeCount(result.BillItemDefs, "property-valuation") = 0,
                uicDetail.Value = data.transferorRecord.LandRecord.Uic,
                landValueDetail.Value = "ETB " + data.landValue,
                buildingValueDetail.Value = "ETB " + data.expectedBuildingValue,
                marketValueDetail.Value = "ETB " + data.landValue,
                saleAmountDetail.Value = "ETB " + data.saleAmount,
                saleValueDetail.Value = "ETB " + data.saleAmount,
                prevSaleDetail.Value = "ETB " + data.prevSaleValue,
                landAreaDetail.Value = data.expectedLandArea,
                result.BillItemDefs[0].Args.MarketValue = data.saleAmount,
                len(result.BillDetails) = 11
            ];
        }
    };

    return [giftSuite, associationSuite, saleSuite];
}
