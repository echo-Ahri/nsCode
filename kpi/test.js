/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/format', 'N/log', 'N/record', 'N/runtime', 'N/search'], function (format, log, record, runtime, search) {
    var RESULT_RECORD_TYPE = 'customrecord_sales_kpi_monthly';

    var RESULT_FIELDS = {
        salesRep: 'custrecord_skm_sales_rep',
        periodText: 'custrecord_skm_period_text',
        startDate: 'custrecord_skm_start_date',
        endDate: 'custrecord_skm_end_date',
        salesOrderAmount: 'custrecord_skm_so_amount',
        invoiceAmount: 'custrecord_skm_invoice_amount',
        grossProfit: 'custrecord_skm_gross_profit',
        grossMargin: 'custrecord_skm_gross_margin',
        collectionRate: 'custrecord_skm_collection_rate',
        overdueAr: 'custrecord_skm_overdue_ar',
        newOppCount: 'custrecord_skm_new_opp_count',
        oppFollowRate: 'custrecord_skm_opp_follow_rate',
        quoteToSoRate: 'custrecord_skm_quote_to_so_rate',
        repurchaseRate: 'custrecord_skm_repurchase_rate',
        contractFollowRate: 'custrecord_skm_contract_follow_rate',
        docCompleteRate: 'custrecord_skm_doc_complete_rate',
        totalScore: 'custrecord_skm_total_score',
        status: 'custrecord_skm_status',
        memo: 'custrecord_skm_memo',
        calcTime: 'custrecord_skm_calc_time'
    };

    var PARAMS = {
        period: 'custscript_skm_period',
        invalidOppKeywords: 'custscript_skm_opp_invalid_keywords',
        ownerFields: 'custscript_skm_owner_fields',
        contractRecordType: 'custscript_skm_contract_rec_type',
        contractOwnerField: 'custscript_skm_contract_owner_field',
        contractDueField: 'custscript_skm_contract_due_field',
        contractUpdateField: 'custscript_skm_contract_update_field'
    };

    var TRANSACTION_TYPE = {
        salesOrder: 'SalesOrd',
        invoice: 'CustInvc',
        customerPayment: 'CustPymt',
        estimate: 'Estimate'
    };

    var DEFAULT_INVALID_OPP_KEYWORDS = ['关闭丢失', '无效', 'closed lost', 'invalid'];
    var DEFAULT_OWNER_FIELDS = ['custbody_salesman', 'salesrep', 'employee'];
    var DEFAULT_CONTRACT_RECORD_TYPE = 'customrecord_document_schedule_form';
    var SALES_ORDER_CANCELLED_STATUS = 'SalesOrd:C';
    var EMPTY_VALUE = '';
    var OWNER_FIELD_CACHE = {};

    function execute(context) {
        try {
            var periodInfo = resolvePeriodInfo();
            var salesRepIds = getTargetSalesRepIds(periodInfo);
            var successCount = 0;
            var failCount = 0;
            var i = 0;

            log.debug('KPI月度统计开始', '月份: ' + periodInfo.periodText);
            log.debug('待统计销售人数', '人数: ' + salesRepIds.length);

            if (!salesRepIds.length) {
                log.debug('KPI月度统计结束', '结果: 无可统计销售人员, 月份: ' + periodInfo.periodText);
                return;
            }

            for (i = 0; i < salesRepIds.length; i += 1) {
                try {
                    processSalesRep(salesRepIds[i], periodInfo);
                    successCount += 1;
                } catch (repError) {
                    failCount += 1;
                    log.error('销售人员计算失败', '销售人员: ' + salesRepIds[i] + ', 错误: ' + getErrorMessage(repError));
                }
            }

            log.debug('KPI月度统计完成', '成功: ' + successCount + ', 失败: ' + failCount + ', 月份: ' + periodInfo.periodText);
        } catch (e) {
            log.error('KPI月度统计失败', '错误: ' + getErrorMessage(e));
            throw e;
        }
    }

    function processSalesRep(salesRepId, periodInfo) {
        var notes = [];
        var repName = getEmployeeName(salesRepId);
        var salesOrderData = getSalesOrderMonthlyData(salesRepId, periodInfo);
        var invoiceData = getInvoiceMonthlyData(salesRepId, periodInfo);
        var salesOrderAmount = calculateSalesOrderAmount(salesOrderData);
        var invoiceAmount = calculateInvoiceAmount(invoiceData);
        var grossProfitInfo = calculateGrossProfit(salesRepId, periodInfo);
        var grossMargin = calculateGrossMargin(grossProfitInfo.amount, invoiceAmount);
        var collectionInfo = calculateCollectionRate(salesRepId, periodInfo, invoiceAmount);
        var overdueArAmount = calculateOverdueArAmount(salesRepId, periodInfo);
        var newOppCount = calculateNewOpportunityCount(salesRepId, periodInfo);
        var oppFollowRateInfo = calculateOpportunityFollowRate(salesRepId, periodInfo);
        var quoteToSoRateInfo = calculateQuoteToSoRate(salesRepId, periodInfo);
        var repurchaseRateInfo = calculateRepurchaseRate(salesRepId, periodInfo, salesOrderData.customerIds);
        var contractFollowRateInfo = calculateContractFollowRate(salesRepId, periodInfo);
        var docCompleteRateInfo = calculateDocumentCompleteRate(salesRepId, periodInfo, salesOrderData.ids);
        var totalScoreInfo = calculateTotalScore();
        var resultData = {};

        appendNote(notes, grossProfitInfo.note);
        appendNote(notes, collectionInfo.note);
        appendNote(notes, oppFollowRateInfo.note);
        appendNote(notes, quoteToSoRateInfo.note);
        appendNote(notes, repurchaseRateInfo.note);
        appendNote(notes, contractFollowRateInfo.note);
        appendNote(notes, docCompleteRateInfo.note);
        appendNote(notes, totalScoreInfo.note);

        resultData.salesRepId = salesRepId;
        resultData.repName = repName;
        resultData.salesOrderAmount = salesOrderAmount;
        resultData.invoiceAmount = invoiceAmount;
        resultData.grossProfit = grossProfitInfo.amount;
        resultData.grossMargin = grossMargin;
        resultData.collectionRate = collectionInfo.rate;
        resultData.overdueAr = overdueArAmount;
        resultData.newOppCount = newOppCount;
        resultData.oppFollowRate = oppFollowRateInfo.rate;
        resultData.quoteToSoRate = quoteToSoRateInfo.rate;
        resultData.repurchaseRate = repurchaseRateInfo.rate;
        resultData.contractFollowRate = contractFollowRateInfo.rate;
        resultData.docCompleteRate = docCompleteRateInfo.rate;
        resultData.totalScore = totalScoreInfo.score;
        resultData.memo = joinNotes(notes);

        upsertMonthlyResult(periodInfo, resultData);

        log.debug('销售人员统计完成', '销售人员: ' + repName + ', 月份: ' + periodInfo.periodText);
    }

    function resolvePeriodInfo() {
        var scriptObj = runtime.getCurrentScript();
        var rawPeriod = toText(scriptObj.getParameter({ name: PARAMS.period })).replace(/\//g, '-').trim();
        var match = null;
        var today = new Date();
        var year = 0;
        var month = 0;
        var startDate = null;
        var endDate = null;
        var periodText = EMPTY_VALUE;

        if (rawPeriod) {
            match = /^(\d{4})-(\d{1,2})$/.exec(rawPeriod);
            if (!match) {
                throw new Error('统计月份参数格式错误，请使用 YYYY-MM。当前值: ' + rawPeriod);
            }
            year = parseInt(match[1], 10);
            month = parseInt(match[2], 10);
        } else {
            year = today.getFullYear();
            month = today.getMonth();
            if (month === 0) {
                year -= 1;
                month = 12;
            }
        }

        if (month < 1 || month > 12) {
            throw new Error('统计月份参数超出范围，月份必须在 1 到 12 之间。当前值: ' + month);
        }

        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0);
        periodText = year + '-' + padLeft(month);

        return {
            year: year,
            month: month,
            periodText: periodText,
            startDate: startDate,
            endDate: endDate,
            startDateText: formatDateValue(startDate),
            endDateText: formatDateValue(endDate)
        };
    }

    function getTargetSalesRepIds(periodInfo) {
        var salesRepIds = [];
        var ownerFields = getOwnerFieldCandidates();

        addUniqueValues(salesRepIds, collectSalesRepIdsFromTransaction(TRANSACTION_TYPE.salesOrder, periodInfo));
        addUniqueValues(salesRepIds, collectSalesRepIdsFromTransaction(TRANSACTION_TYPE.invoice, periodInfo));
        addUniqueValues(salesRepIds, collectSalesRepIdsFromTransaction(TRANSACTION_TYPE.estimate, periodInfo));
        addUniqueValues(salesRepIds, collectSalesRepIdsFromOpportunity(periodInfo));
        addUniqueValues(salesRepIds, collectSalesRepIdsFromOverdueInvoice(periodInfo));

        log.debug('销售归属字段候选', '字段: ' + ownerFields.join(','));
        return salesRepIds;
    }

    function collectSalesRepIdsFromTransaction(typeId, periodInfo) {
        return collectGroupedValuesByOwnerFields(getOwnerFieldCandidates(), function (ownerFieldId) {
            return search.create({
                type: search.Type.TRANSACTION,
                filters: buildTransactionDateFilters(typeId, periodInfo, [], EMPTY_VALUE, ownerFieldId),
                columns: [
                    search.createColumn({ name: ownerFieldId, summary: search.Summary.GROUP })
                ]
            });
        }, 'transaction:' + typeId, '交易单据-' + typeId);
    }

    function collectSalesRepIdsFromOpportunity(periodInfo) {
        return collectGroupedValuesByOwnerFields(getOwnerFieldCandidates(), function (ownerFieldId) {
            return search.create({
                type: 'opportunity',
                filters: buildOpportunityFilters(periodInfo, EMPTY_VALUE, ownerFieldId),
                columns: [
                    search.createColumn({ name: ownerFieldId, summary: search.Summary.GROUP })
                ]
            });
        }, 'opportunity', '商机');
    }

    function collectSalesRepIdsFromOverdueInvoice(periodInfo) {
        return collectGroupedValuesByOwnerFields(getOwnerFieldCandidates(), function (ownerFieldId) {
            return search.create({
                type: search.Type.TRANSACTION,
                filters: [
                    ['type', 'anyof', TRANSACTION_TYPE.invoice],
                    'and',
                    ['mainline', 'is', 'T'],
                    'and',
                    [ownerFieldId, 'noneof', '@NONE@'],
                    'and',
                    ['amountremaining', 'greaterthan', '0.00'],
                    'and',
                    ['duedate', 'onorbefore', periodInfo.endDateText]
                ],
                columns: [
                    search.createColumn({ name: ownerFieldId, summary: search.Summary.GROUP })
                ]
            });
        }, 'transaction:' + TRANSACTION_TYPE.invoice, '逾期应收发票');
    }

    function getSalesOrderMonthlyData(salesRepId, periodInfo) {
        var results = getTransactionResultsByOwnerFields(TRANSACTION_TYPE.salesOrder, periodInfo, [
            ['status', 'noneof', SALES_ORDER_CANCELLED_STATUS]
        ], salesRepId, ['internalid', 'amount', 'entity'], '销售订单');
        var amount = 0;
        var ids = [];
        var customerIds = [];
        var i = 0;
        var result = null;
        var currentId = EMPTY_VALUE;
        var currentCustomerId = EMPTY_VALUE;

        for (i = 0; i < results.length; i += 1) {
            result = results[i];
            currentId = toText(result.getValue({ name: 'internalid' }));
            currentCustomerId = toText(result.getValue({ name: 'entity' }));
            amount += toNumber(result.getValue({ name: 'amount' }));
            if (currentId) {
                ids.push(currentId);
            }
            if (currentCustomerId) {
                addUniqueValue(customerIds, currentCustomerId);
            }
        }

        return {
            amount: roundNumber(amount),
            ids: ids,
            customerIds: customerIds
        };
    }

    function calculateSalesOrderAmount(salesOrderData) {
        return roundNumber(salesOrderData.amount);
    }

    function getInvoiceMonthlyData(salesRepId, periodInfo) {
        var results = getTransactionResultsByOwnerFields(TRANSACTION_TYPE.invoice, periodInfo, [], salesRepId, ['internalid', 'amount'], '发票');
        var amount = 0;
        var i = 0;

        for (i = 0; i < results.length; i += 1) {
            amount += toNumber(results[i].getValue({ name: 'amount' }));
        }

        return {
            amount: roundNumber(amount)
        };
    }

    function calculateInvoiceAmount(invoiceData) {
        return roundNumber(invoiceData.amount);
    }

    function calculateGrossProfit(salesRepId, periodInfo) {
        var amount = 0;
        var note = EMPTY_VALUE;
        var results = [];
        var i = 0;

        try {
            results = getTransactionResultsByOwnerFields(TRANSACTION_TYPE.invoice, periodInfo, [], salesRepId, ['internalid', 'grossprofit'], '毛利发票');

            for (i = 0; i < results.length; i += 1) {
                amount += toNumber(results[i].getValue({ name: 'grossprofit' }));
            }
        } catch (e) {
            note = '毛利额当前未确认系统 grossprofit 字段口径，本期默认写 0。';
            log.error('毛利额读取失败', '销售人员: ' + salesRepId + ', 错误: ' + getErrorMessage(e));
            amount = 0;
        }

        return {
            amount: roundNumber(amount),
            note: note
        };
    }

    function calculateGrossMargin(grossProfit, invoiceAmount) {
        return roundNumber(safeDivide(grossProfit, invoiceAmount) * 100);
    }

    function calculateCollectionRate(salesRepId, periodInfo, invoiceAmount) {
        var customerIds = getCustomerIdsByCurrentSalesRep(salesRepId);
        var paymentAmount = 0;
        var rate = 0;
        var note = '回款达成率第一阶段按客户当前销售负责人近似归属客户付款。';
        var batches = [];
        var batchIndex = 0;
        var filters = [];
        var results = [];
        var i = 0;

        if (!customerIds.length) {
            return {
                amount: 0,
                rate: 0,
                note: note
            };
        }

        batches = splitArray(customerIds, 1000);

        for (batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
            filters = buildTransactionDateFilters(TRANSACTION_TYPE.customerPayment, periodInfo, [
                ['entity', 'anyof', batches[batchIndex]]
            ]);
            results = getAllResults(search.create({
                type: search.Type.TRANSACTION,
                filters: filters,
                columns: ['amount']
            }));

            for (i = 0; i < results.length; i += 1) {
                paymentAmount += toNumber(results[i].getValue({ name: 'amount' }));
            }
        }

        rate = roundNumber(safeDivide(paymentAmount, invoiceAmount) * 100);

        return {
            amount: roundNumber(paymentAmount),
            rate: rate,
            note: note
        };
    }

    function getCustomerIdsByCurrentSalesRep(salesRepId) {
        var results = getAllResults(search.create({
            type: 'customer',
            filters: [
                ['salesrep', 'anyof', salesRepId],
                'and',
                ['isinactive', 'is', 'F']
            ],
            columns: ['internalid']
        }));
        var customerIds = [];
        var i = 0;
        var customerId = EMPTY_VALUE;

        for (i = 0; i < results.length; i += 1) {
            customerId = toText(results[i].getValue({ name: 'internalid' }));
            if (customerId) {
                addUniqueValue(customerIds, customerId);
            }
        }

        return customerIds;
    }

    function calculateOverdueArAmount(salesRepId, periodInfo) {
        var results = getTransactionResultsByOwnerFields(TRANSACTION_TYPE.invoice, periodInfo, [
            ['amountremaining', 'greaterthan', '0.00'],
            ['duedate', 'onorbefore', periodInfo.endDateText]
        ], salesRepId, ['internalid', 'amountremaining'], '逾期应收');
        var amount = 0;
        var i = 0;

        for (i = 0; i < results.length; i += 1) {
            amount += toNumber(results[i].getValue({ name: 'amountremaining' }));
        }

        return roundNumber(amount);
    }

    function calculateNewOpportunityCount(salesRepId, periodInfo) {
        var results = getOpportunityResultsByOwnerFields(periodInfo, salesRepId, ['internalid', 'entitystatus'], '有效商机');
        var keywords = getInvalidOpportunityKeywords();
        var count = 0;
        var i = 0;
        var statusText = EMPTY_VALUE;

        for (i = 0; i < results.length; i += 1) {
            statusText = toLowerText(results[i].getText({ name: 'entitystatus' }) || results[i].getValue({ name: 'entitystatus' }));
            if (!containsAnyKeyword(statusText, keywords)) {
                count += 1;
            }
        }

        return count;
    }

    function calculateOpportunityFollowRate(salesRepId, periodInfo) {
        return {
            rate: 0,
            note: '商机跟进及时率第一阶段未识别到统一跟进日期字段，本期先返回 0。'
        };
    }

    function calculateQuoteToSoRate(salesRepId, periodInfo) {
        var estimateIds = getEstimateIdsByMonth(salesRepId, periodInfo);
        var estimateIdMap = arrayToMap(estimateIds);
        var results = [];
        var convertedEstimateIds = [];
        var i = 0;
        var createdFromId = EMPTY_VALUE;
        var rate = 0;

        if (!estimateIds.length) {
            return {
                rate: 0,
                note: '报价转订单率第一阶段按 Estimate 与 Sales Order 的 createdfrom 关系近似统计。'
            };
        }

        results = getTransactionResultsByOwnerFields(TRANSACTION_TYPE.salesOrder, periodInfo, [
            ['status', 'noneof', SALES_ORDER_CANCELLED_STATUS],
            ['createdfrom', 'noneof', '@NONE@']
        ], salesRepId, ['internalid', 'createdfrom'], '报价转订单');

        for (i = 0; i < results.length; i += 1) {
            createdFromId = toText(results[i].getValue({ name: 'createdfrom' }));
            if (createdFromId && estimateIdMap[createdFromId]) {
                addUniqueValue(convertedEstimateIds, createdFromId);
            }
        }

        rate = roundNumber(safeDivide(convertedEstimateIds.length, estimateIds.length) * 100);

        return {
            rate: rate,
            note: '报价转订单率第一阶段按 Estimate 与 Sales Order 的 createdfrom 关系近似统计。'
        };
    }

    function getEstimateIdsByMonth(salesRepId, periodInfo) {
        var results = getTransactionResultsByOwnerFields(TRANSACTION_TYPE.estimate, periodInfo, [], salesRepId, ['internalid'], '报价单');
        var ids = [];
        var i = 0;
        var estimateId = EMPTY_VALUE;

        for (i = 0; i < results.length; i += 1) {
            estimateId = toText(results[i].getValue({ name: 'internalid' }));
            if (estimateId) {
                addUniqueValue(ids, estimateId);
            }
        }

        return ids;
    }

    function calculateRepurchaseRate(salesRepId, periodInfo, currentCustomerIds) {
        var oldCustomerIds = getHistoricalSalesOrderCustomerIds(salesRepId, periodInfo);
        var oldCustomerMap = arrayToMap(oldCustomerIds);
        var repeatCount = 0;
        var i = 0;
        var currentCustomerId = EMPTY_VALUE;
        var rate = 0;

        if (!oldCustomerIds.length) {
            return {
                rate: 0,
                note: '老客户复购率按历史销售订单客户近似定义老客户。'
            };
        }

        for (i = 0; i < currentCustomerIds.length; i += 1) {
            currentCustomerId = currentCustomerIds[i];
            if (oldCustomerMap[currentCustomerId]) {
                repeatCount += 1;
            }
        }

        rate = roundNumber(safeDivide(repeatCount, oldCustomerIds.length) * 100);

        return {
            rate: rate,
            note: '老客户复购率按历史销售订单客户近似定义老客户。'
        };
    }

    function getHistoricalSalesOrderCustomerIds(salesRepId, periodInfo) {
        var results = getTransactionResultsBeforeDateByOwnerFields(TRANSACTION_TYPE.salesOrder, periodInfo.startDateText, [
            ['status', 'noneof', SALES_ORDER_CANCELLED_STATUS]
        ], salesRepId, ['internalid', 'entity'], '历史销售订单');
        var customerIds = [];
        var i = 0;
        var customerId = EMPTY_VALUE;

        for (i = 0; i < results.length; i += 1) {
            customerId = toText(results[i].getValue({ name: 'entity' }));
            if (customerId) {
                addUniqueValue(customerIds, customerId);
            }
        }

        return customerIds;
    }

    function calculateContractFollowRate(salesRepId, periodInfo) {
        var scriptObj = runtime.getCurrentScript();
        var recordType = toText(scriptObj.getParameter({ name: PARAMS.contractRecordType })).trim() || DEFAULT_CONTRACT_RECORD_TYPE;
        var ownerField = toText(scriptObj.getParameter({ name: PARAMS.contractOwnerField })).trim();
        var dueField = toText(scriptObj.getParameter({ name: PARAMS.contractDueField })).trim();
        var updateField = toText(scriptObj.getParameter({ name: PARAMS.contractUpdateField })).trim();
        var results = [];
        var timelyCount = 0;
        var totalCount = 0;
        var i = 0;
        var dueValue = null;
        var updateValue = null;

        if (!recordType || !ownerField || !dueField || !updateField) {
            return {
                rate: 0,
                note: '合同执行进度跟进及时率已预留，需确认合同进度表记录类型及负责人/应跟进/最近跟进字段。'
            };
        }

        try {
            results = getAllResults(search.create({
                type: recordType,
                filters: [
                    [ownerField, 'anyof', salesRepId],
                    'and',
                    [dueField, 'within', periodInfo.startDateText, periodInfo.endDateText]
                ],
                columns: ['internalid', dueField, updateField]
            }));

            for (i = 0; i < results.length; i += 1) {
                dueValue = parseFlexibleDate(results[i].getValue({ name: dueField }));
                updateValue = parseFlexibleDate(results[i].getValue({ name: updateField }));

                if (dueValue) {
                    totalCount += 1;
                }

                if (dueValue && updateValue && updateValue.getTime() <= dueValue.getTime()) {
                    timelyCount += 1;
                }
            }

            return {
                rate: roundNumber(safeDivide(timelyCount, totalCount) * 100),
                note: EMPTY_VALUE
            };
        } catch (e) {
            log.error('合同进度统计失败', '销售人员: ' + salesRepId + ', 错误: ' + getErrorMessage(e));
            return {
                rate: 0,
                note: '合同执行进度跟进及时率已预留，但当前字段或记录类型未确认，暂返回 0。'
            };
        }
    }

    function calculateDocumentCompleteRate(salesRepId, periodInfo, salesOrderIds) {
        var completeCount = 0;
        var i = 0;
        var mainlineDataMap = {};
        var itemCountMap = {};
        var currentSalesOrderId = EMPTY_VALUE;
        var currentMainlineData = null;
        var itemCount = 0;

        if (!salesOrderIds.length) {
            return {
                rate: 0,
                note: EMPTY_VALUE
            };
        }

        try {
            // 这里改为纯搜索统计，避免销售订单被工作流锁定时 record.load 报错。
            mainlineDataMap = getSalesOrderMainlineDataMap(salesOrderIds);
            itemCountMap = getSalesOrderItemCountMap(salesOrderIds);

            for (i = 0; i < salesOrderIds.length; i += 1) {
                currentSalesOrderId = salesOrderIds[i];
                currentMainlineData = mainlineDataMap[currentSalesOrderId];
                itemCount = toNumber(itemCountMap[currentSalesOrderId]);

                if (
                    currentMainlineData &&
                    currentMainlineData.entityValue &&
                    currentMainlineData.tranDateValue &&
                    currentMainlineData.totalHasValue &&
                    itemCount > 0
                ) {
                    completeCount += 1;
                }
            }
        } catch (e) {
            log.error('销售订单完整率统计失败', '销售人员: ' + salesRepId + ', 错误: ' + getErrorMessage(e));
            return {
                rate: 0,
                note: '单据填写完整率统计失败，当前已改为搜索口径；请检查销售订单搜索字段权限。'
            };
        }

        return {
            rate: roundNumber(safeDivide(completeCount, salesOrderIds.length) * 100),
            note: EMPTY_VALUE
        };
    }

    function getSalesOrderMainlineDataMap(salesOrderIds) {
        var dataMap = {};
        var batches = splitArray(salesOrderIds, 1000);
        var batchIndex = 0;
        var results = [];
        var i = 0;
        var salesOrderId = EMPTY_VALUE;

        for (batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
            results = getAllResults(search.create({
                type: search.Type.TRANSACTION,
                filters: [
                    ['type', 'anyof', TRANSACTION_TYPE.salesOrder],
                    'and',
                    ['mainline', 'is', 'T'],
                    'and',
                    ['internalid', 'anyof', batches[batchIndex]]
                ],
                columns: ['internalid', 'entity', 'trandate', 'total']
            }));

            for (i = 0; i < results.length; i += 1) {
                salesOrderId = toText(results[i].getValue({ name: 'internalid' }));
                if (!salesOrderId) {
                    continue;
                }

                dataMap[salesOrderId] = {
                    entityValue: results[i].getValue({ name: 'entity' }),
                    tranDateValue: results[i].getValue({ name: 'trandate' }),
                    totalHasValue: hasSearchValue(results[i].getValue({ name: 'total' }))
                };
            }
        }

        return dataMap;
    }

    function getSalesOrderItemCountMap(salesOrderIds) {
        try {
            return getSalesOrderItemCountMapByMode(salesOrderIds, true);
        } catch (e) {
            log.debug('销售订单行数搜索回退', '错误: ' + getErrorMessage(e));
            return getSalesOrderItemCountMapByMode(salesOrderIds, false);
        }
    }

    function getSalesOrderItemCountMapByMode(salesOrderIds, useExtraLineFilters) {
        var dataMap = {};
        var batches = splitArray(salesOrderIds, 1000);
        var batchIndex = 0;
        var filters = [];
        var results = [];
        var i = 0;
        var salesOrderId = EMPTY_VALUE;

        for (batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
            filters = [
                ['type', 'anyof', TRANSACTION_TYPE.salesOrder],
                'and',
                ['mainline', 'is', 'F'],
                'and',
                ['internalid', 'anyof', batches[batchIndex]],
                'and',
                ['item', 'noneof', '@NONE@']
            ];

            if (useExtraLineFilters) {
                filters.push('and');
                filters.push(['taxline', 'is', 'F']);
                filters.push('and');
                filters.push(['shipping', 'is', 'F']);
            }

            results = getAllResults(search.create({
                type: search.Type.TRANSACTION,
                filters: filters,
                columns: [
                    search.createColumn({ name: 'internalid', summary: search.Summary.GROUP }),
                    search.createColumn({ name: 'item', summary: search.Summary.COUNT })
                ]
            }));

            for (i = 0; i < results.length; i += 1) {
                salesOrderId = toText(results[i].getValue({ name: 'internalid', summary: search.Summary.GROUP }));
                if (!salesOrderId) {
                    continue;
                }
                dataMap[salesOrderId] = toNumber(results[i].getValue({ name: 'item', summary: search.Summary.COUNT }));
            }
        }

        return dataMap;
    }

    function calculateTotalScore() {
        return {
            score: 0,
            note: 'KPI总分公式尚未确定，本期默认写 0。'
        };
    }

    function upsertMonthlyResult(periodInfo, resultData) {
        var existingId = findExistingMonthlyResult(resultData.salesRepId, periodInfo.periodText);
        var resultRecord = null;
        var statusText = EMPTY_VALUE;

        if (existingId) {
            resultRecord = record.load({
                type: RESULT_RECORD_TYPE,
                id: existingId,
                isDynamic: false
            });
            statusText = resultData.memo ? '已更新（含近似口径）' : '已更新';
        } else {
            resultRecord = record.create({
                type: RESULT_RECORD_TYPE,
                isDynamic: false
            });
            statusText = resultData.memo ? '已计算（含近似口径）' : '已计算';
        }

        // 统一写入月度 KPI 结果字段。
        resultRecord.setValue({ fieldId: 'name', value: resultData.repName + '-' + periodInfo.periodText });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.salesRep, value: resultData.salesRepId });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.periodText, value: periodInfo.periodText });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.startDate, value: periodInfo.startDate });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.endDate, value: periodInfo.endDate });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.salesOrderAmount, value: resultData.salesOrderAmount });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.invoiceAmount, value: resultData.invoiceAmount });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.grossProfit, value: resultData.grossProfit });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.grossMargin, value: resultData.grossMargin });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.collectionRate, value: resultData.collectionRate });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.overdueAr, value: resultData.overdueAr });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.newOppCount, value: resultData.newOppCount });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.oppFollowRate, value: resultData.oppFollowRate });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.quoteToSoRate, value: resultData.quoteToSoRate });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.repurchaseRate, value: resultData.repurchaseRate });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.contractFollowRate, value: resultData.contractFollowRate });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.docCompleteRate, value: resultData.docCompleteRate });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.totalScore, value: resultData.totalScore });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.status, value: statusText });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.memo, value: resultData.memo || EMPTY_VALUE });
        resultRecord.setValue({ fieldId: RESULT_FIELDS.calcTime, value: new Date() });

        resultRecord.save();
    }

    function findExistingMonthlyResult(salesRepId, periodText) {
        var results = getAllResults(search.create({
            type: RESULT_RECORD_TYPE,
            filters: [
                [RESULT_FIELDS.salesRep, 'anyof', salesRepId],
                'and',
                [RESULT_FIELDS.periodText, 'is', periodText]
            ],
            columns: ['internalid']
        }));

        if (!results.length) {
            return EMPTY_VALUE;
        }

        return toText(results[0].getValue({ name: 'internalid' }));
    }

    function getOwnerFieldCandidates() {
        var rawValue = toText(runtime.getCurrentScript().getParameter({ name: PARAMS.ownerFields })).trim();
        var source = rawValue ? rawValue.split(',') : DEFAULT_OWNER_FIELDS;
        var ownerFields = [];
        var i = 0;
        var currentValue = EMPTY_VALUE;

        for (i = 0; i < source.length; i += 1) {
            currentValue = toText(source[i]).trim();
            if (currentValue) {
                addUniqueValue(ownerFields, currentValue);
            }
        }

        if (!ownerFields.length) {
            ownerFields = DEFAULT_OWNER_FIELDS.slice(0);
        }

        return ownerFields;
    }

    function collectGroupedValuesByOwnerFields(ownerFields, searchFactory, cacheKey, sourceLabel) {
        var i = 0;
        var ownerFieldId = EMPTY_VALUE;
        var results = [];
        var cachedOwnerFieldId = toText(OWNER_FIELD_CACHE[cacheKey]).trim();

        if (cachedOwnerFieldId) {
            return getGroupedValuesForOwnerField(cachedOwnerFieldId, searchFactory, sourceLabel, true);
        }

        for (i = 0; i < ownerFields.length; i += 1) {
            ownerFieldId = ownerFields[i];

            try {
                results = getAllResults(searchFactory(ownerFieldId));
                if (results.length) {
                    OWNER_FIELD_CACHE[cacheKey] = ownerFieldId;
                    log.debug('归属字段命中', '来源: ' + sourceLabel + ', 字段: ' + ownerFieldId + ', 结果数: ' + results.length);
                    return getGroupedValues(results, ownerFieldId);
                }
            } catch (e) {
                log.debug('归属字段跳过', '来源: ' + sourceLabel + ', 字段: ' + ownerFieldId + ', 错误: ' + getErrorMessage(e));
            }
        }

        return [];
    }

    function getTransactionResultsByOwnerFields(typeId, periodInfo, extraFilters, salesRepId, columns, sourceLabel) {
        return collectResultsByOwnerFields(getOwnerFieldCandidates(), function (ownerFieldId, normalizedColumns) {
            return search.create({
                type: search.Type.TRANSACTION,
                filters: buildTransactionDateFilters(typeId, periodInfo, extraFilters, salesRepId, ownerFieldId),
                columns: normalizedColumns
            });
        }, columns, 'transaction:' + typeId, sourceLabel);
    }

    function getTransactionResultsBeforeDateByOwnerFields(typeId, beforeDateText, extraFilters, salesRepId, columns, sourceLabel) {
        return collectResultsByOwnerFields(getOwnerFieldCandidates(), function (ownerFieldId, normalizedColumns) {
            return search.create({
                type: search.Type.TRANSACTION,
                filters: buildTransactionBeforeDateFilters(typeId, beforeDateText, extraFilters, salesRepId, ownerFieldId),
                columns: normalizedColumns
            });
        }, columns, 'transaction:' + typeId, sourceLabel);
    }

    function getOpportunityResultsByOwnerFields(periodInfo, salesRepId, columns, sourceLabel) {
        return collectResultsByOwnerFields(getOwnerFieldCandidates(), function (ownerFieldId, normalizedColumns) {
            return search.create({
                type: 'opportunity',
                filters: buildOpportunityFilters(periodInfo, salesRepId, ownerFieldId),
                columns: normalizedColumns
            });
        }, columns, 'opportunity', sourceLabel);
    }

    function collectResultsByOwnerFields(ownerFields, searchFactory, columns, cacheKey, sourceLabel) {
        var normalizedColumns = ensureInternalIdColumn(columns);
        var i = 0;
        var ownerFieldId = EMPTY_VALUE;
        var results = [];
        var cachedOwnerFieldId = toText(OWNER_FIELD_CACHE[cacheKey]).trim();

        if (cachedOwnerFieldId) {
            return getResultsForOwnerField(cachedOwnerFieldId, searchFactory, normalizedColumns, sourceLabel, true);
        }

        for (i = 0; i < ownerFields.length; i += 1) {
            ownerFieldId = ownerFields[i];

            try {
                results = getAllResults(searchFactory(ownerFieldId, normalizedColumns.slice(0)));
                if (results.length) {
                    OWNER_FIELD_CACHE[cacheKey] = ownerFieldId;
                    log.debug('归属字段取数成功', '来源: ' + sourceLabel + ', 字段: ' + ownerFieldId + ', 结果数: ' + results.length);
                    return results;
                }
            } catch (e) {
                log.debug('归属字段取数跳过', '来源: ' + sourceLabel + ', 字段: ' + ownerFieldId + ', 错误: ' + getErrorMessage(e));
            }
        }

        return [];
    }

    function getGroupedValuesForOwnerField(ownerFieldId, searchFactory, sourceLabel, fromCache) {
        var results = [];

        try {
            results = getAllResults(searchFactory(ownerFieldId));
            if (results.length) {
                log.debug('归属字段复用', '来源: ' + sourceLabel + ', 字段: ' + ownerFieldId + ', 来自缓存: ' + (fromCache ? 'T' : 'F') + ', 结果数: ' + results.length);
            }
            return getGroupedValues(results, ownerFieldId);
        } catch (e) {
            log.debug('归属字段缓存失效', '来源: ' + sourceLabel + ', 字段: ' + ownerFieldId + ', 错误: ' + getErrorMessage(e));
            return [];
        }
    }

    function getResultsForOwnerField(ownerFieldId, searchFactory, normalizedColumns, sourceLabel, fromCache) {
        var results = [];

        try {
            results = getAllResults(searchFactory(ownerFieldId, normalizedColumns.slice(0)));
            if (results.length) {
                log.debug('归属字段复用', '来源: ' + sourceLabel + ', 字段: ' + ownerFieldId + ', 来自缓存: ' + (fromCache ? 'T' : 'F') + ', 结果数: ' + results.length);
            }
            return results;
        } catch (e) {
            log.debug('归属字段缓存失效', '来源: ' + sourceLabel + ', 字段: ' + ownerFieldId + ', 错误: ' + getErrorMessage(e));
            return [];
        }
    }

    function mergeUniqueResultsByInternalId(targetResults, seenIds, sourceResults) {
        var i = 0;
        var internalId = EMPTY_VALUE;

        for (i = 0; i < sourceResults.length; i += 1) {
            internalId = toText(sourceResults[i].getValue({ name: 'internalid' }));

            if (!internalId) {
                targetResults.push(sourceResults[i]);
                continue;
            }

            if (!seenIds[internalId]) {
                seenIds[internalId] = true;
                targetResults.push(sourceResults[i]);
            }
        }
    }

    function ensureInternalIdColumn(columns) {
        var normalizedColumns = columns ? columns.slice(0) : [];

        if (!hasColumn(normalizedColumns, 'internalid')) {
            normalizedColumns.push('internalid');
        }

        return normalizedColumns;
    }

    function hasColumn(columns, fieldName) {
        var i = 0;

        for (i = 0; i < columns.length; i += 1) {
            if (getColumnName(columns[i]) === fieldName) {
                return true;
            }
        }

        return false;
    }

    function getColumnName(column) {
        if (typeof column === 'string') {
            return column;
        }

        if (column && column.name) {
            return column.name;
        }

        return EMPTY_VALUE;
    }

    function buildTransactionDateFilters(typeId, periodInfo, extraFilters, salesRepId, ownerFieldId) {
        var filters = [
            ['type', 'anyof', typeId],
            'and',
            ['mainline', 'is', 'T'],
            'and',
            ['trandate', 'within', periodInfo.startDateText, periodInfo.endDateText]
        ];
        var i = 0;

        if (salesRepId && ownerFieldId) {
            filters.push('and');
            filters.push([ownerFieldId, 'anyof', salesRepId]);
        }

        if (!extraFilters || !extraFilters.length) {
            return filters;
        }

        for (i = 0; i < extraFilters.length; i += 1) {
            filters.push('and');
            filters.push(extraFilters[i]);
        }

        return filters;
    }

    function buildTransactionBeforeDateFilters(typeId, beforeDateText, extraFilters, salesRepId, ownerFieldId) {
        var filters = [
            ['type', 'anyof', typeId],
            'and',
            ['mainline', 'is', 'T'],
            'and',
            ['trandate', 'before', beforeDateText]
        ];
        var i = 0;

        if (salesRepId && ownerFieldId) {
            filters.push('and');
            filters.push([ownerFieldId, 'anyof', salesRepId]);
        }

        if (!extraFilters || !extraFilters.length) {
            return filters;
        }

        for (i = 0; i < extraFilters.length; i += 1) {
            filters.push('and');
            filters.push(extraFilters[i]);
        }

        return filters;
    }

    function buildOpportunityFilters(periodInfo, salesRepId, ownerFieldId) {
        var filters = [
            [
                ['datecreated', 'within', periodInfo.startDateText, periodInfo.endDateText],
                'or',
                ['expectedclosedate', 'within', periodInfo.startDateText, periodInfo.endDateText]
            ]
        ];

        if (salesRepId && ownerFieldId) {
            filters.push('and');
            filters.push([ownerFieldId, 'anyof', salesRepId]);
        }

        return filters;
    }

    function getTransactionOwnerValueFromRecord(transactionRecord) {
        var ownerFields = getOwnerFieldCandidates();
        var i = 0;
        var ownerValue = null;

        for (i = 0; i < ownerFields.length; i += 1) {
            try {
                ownerValue = transactionRecord.getValue({ fieldId: ownerFields[i] });
                if (ownerValue) {
                    return ownerValue;
                }
            } catch (e) {
            }
        }

        return EMPTY_VALUE;
    }

    function getInvalidOpportunityKeywords() {
        var rawValue = toText(runtime.getCurrentScript().getParameter({ name: PARAMS.invalidOppKeywords })).trim();
        var values = [];
        var source = [];
        var i = 0;

        source = rawValue ? rawValue.split(',') : DEFAULT_INVALID_OPP_KEYWORDS;

        for (i = 0; i < source.length; i += 1) {
            if (toText(source[i]).trim()) {
                values.push(toLowerText(source[i]));
            }
        }

        return values;
    }

    function getEmployeeName(employeeId) {
        var fields = null;
        var displayName = EMPTY_VALUE;

        try {
            fields = search.lookupFields({
                type: 'employee',
                id: employeeId,
                columns: ['entityid', 'firstname', 'lastname']
            });

            displayName = toText(fields.firstname).trim() + toText(fields.lastname).trim();
            displayName = displayName.replace(/\s+/g, '');

            if (!displayName) {
                displayName = toText(fields.entityid).trim();
            }

            return displayName || ('EMP' + employeeId);
        } catch (e) {
            log.error('员工名称读取失败', '员工ID: ' + employeeId + ', 错误: ' + getErrorMessage(e));
            return 'EMP' + employeeId;
        }
    }

    function getAllResults(searchObj) {
        var allResults = [];
        var pagedData = searchObj.runPaged({ pageSize: 1000 });
        var pageIndex = 0;
        var page = null;
        var resultIndex = 0;

        for (pageIndex = 0; pageIndex < pagedData.pageRanges.length; pageIndex += 1) {
            page = pagedData.fetch({ index: pagedData.pageRanges[pageIndex].index });

            for (resultIndex = 0; resultIndex < page.data.length; resultIndex += 1) {
                allResults.push(page.data[resultIndex]);
            }
        }

        return allResults;
    }

    function getGroupedValues(results, fieldName) {
        var values = [];
        var i = 0;
        var value = EMPTY_VALUE;

        for (i = 0; i < results.length; i += 1) {
            value = toText(results[i].getValue({ name: fieldName, summary: search.Summary.GROUP }));
            if (value) {
                addUniqueValue(values, value);
            }
        }

        return values;
    }

    function containsAnyKeyword(text, keywords) {
        var i = 0;

        for (i = 0; i < keywords.length; i += 1) {
            if (text.indexOf(keywords[i]) > -1) {
                return true;
            }
        }

        return false;
    }

    function parseFlexibleDate(value) {
        var rawValue = toText(value).trim();
        var parsedValue = null;

        if (!rawValue) {
            return null;
        }

        try {
            parsedValue = format.parse({
                value: rawValue,
                type: format.Type.DATE
            });
            if (parsedValue) {
                return parsedValue;
            }
        } catch (e1) {
        }

        try {
            parsedValue = format.parse({
                value: rawValue,
                type: format.Type.DATETIMETZ
            });
            if (parsedValue) {
                return parsedValue;
            }
        } catch (e2) {
        }

        parsedValue = new Date(rawValue);
        if (parsedValue && !isNaN(parsedValue.getTime())) {
            return parsedValue;
        }

        return null;
    }

    function formatDateValue(dateValue) {
        return format.format({
            value: dateValue,
            type: format.Type.DATE
        });
    }

    function splitArray(values, batchSize) {
        var batches = [];
        var index = 0;

        for (index = 0; index < values.length; index += batchSize) {
            batches.push(values.slice(index, index + batchSize));
        }

        return batches;
    }

    function appendNote(notes, note) {
        if (!note) {
            return;
        }
        if (notes.indexOf(note) === -1) {
            notes.push(note);
        }
    }

    function joinNotes(notes) {
        if (!notes || !notes.length) {
            return EMPTY_VALUE;
        }
        return notes.join('；');
    }

    function addUniqueValues(target, values) {
        var i = 0;

        for (i = 0; i < values.length; i += 1) {
            addUniqueValue(target, values[i]);
        }
    }

    function addUniqueValue(target, value) {
        if (value && target.indexOf(value) === -1) {
            target.push(value);
        }
    }

    function arrayToMap(values) {
        var map = {};
        var i = 0;

        for (i = 0; i < values.length; i += 1) {
            map[values[i]] = true;
        }

        return map;
    }

    function safeDivide(numerator, denominator) {
        if (!denominator) {
            return 0;
        }
        return numerator / denominator;
    }

    function roundNumber(value) {
        var numberValue = toNumber(value);
        return Math.round(numberValue * 100) / 100;
    }

    function hasSearchValue(value) {
        return value !== null && value !== undefined && toText(value) !== EMPTY_VALUE;
    }

    function toNumber(value) {
        var numberValue = Number(value);
        if (isNaN(numberValue)) {
            return 0;
        }
        return numberValue;
    }

    function toText(value) {
        if (value === null || value === undefined) {
            return EMPTY_VALUE;
        }
        return String(value);
    }

    function toLowerText(value) {
        return toText(value).toLowerCase();
    }

    function padLeft(numberValue) {
        if (numberValue < 10) {
            return '0' + numberValue;
        }
        return String(numberValue);
    }

    function getErrorMessage(errorObj) {
        if (!errorObj) {
            return EMPTY_VALUE;
        }
        if (errorObj.stack) {
            return errorObj.name + ': ' + errorObj.message + ', stack: ' + errorObj.stack;
        }
        if (errorObj.name || errorObj.message) {
            return toText(errorObj.name) + ': ' + toText(errorObj.message);
        }
        return toText(errorObj);
    }

    return {
        execute: execute
    };
});
