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
    var KPI_CONFIG_RECORD_TYPE = 'customrecord_skm_cfg_dsp';
    var KPI_CONFIG_FIELDS = {
        id: 'internalid',
        period: 'custrecord_skm_cfg_period',
        metricConfigJson: 'custrecord_skm_cfg_metric_json',
        lastMessage: 'custrecord_skm_cfg_last_msg'
    };
    var SALES_ORDER_CANCELLED_STATUS = 'SalesOrd:C';
    var EMPTY_VALUE = '';
    var OWNER_FIELD_CACHE = {};
    var KPI_CONFIG_CACHE = null;

    /**
     * 方法作用：脚本入口：按统计周期批量计算销售KPI并记录结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：context。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function execute(context) {
        try {
            // 先解析统计周期，再按该周期收集需要计算的销售人员。
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
            updateKpiExecutionMessage('KPI月度统计完成 成功: ' + successCount + ', 失败: ' + failCount + ', 月份: ' + periodInfo.periodText);
        } catch (e) {
            log.error('KPI月度统计失败', '错误: ' + getErrorMessage(e));
            updateKpiExecutionMessage('执行失败, 请查看日志');
            throw e;
        }
    }

    /**
     * 方法作用：按单个销售人员聚合12项指标并写入月度结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesRepId、periodInfo。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function processSalesRep(salesRepId, periodInfo) {
        var metricConfig = getMetricConfig();
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

        if (metricConfig.onlyGenerateWhenActive && !hasMonthlyBusinessActivity(salesRepId, periodInfo, salesOrderData, invoiceData, newOppCount)) {
            log.debug('跳过写入KPI结果', '销售人员: ' + repName + ', 月份: ' + periodInfo.periodText + ', 原因: 开启“仅当月有业务才生成记录”且当月无业务数据');
            return;
        }

        upsertMonthlyResult(periodInfo, resultData);

        log.debug('销售人员统计完成', '销售人员: ' + repName + ', 月份: ' + periodInfo.periodText);
    }

    /**
     * 方法作用：解析统计周期，支持脚本参数与配置中心回退。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：无。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function resolvePeriodInfo() {
        var scriptObj = runtime.getCurrentScript();
        // 优先使用脚本参数；若未传则回退读取“指标配置中心”最近一次保存的期间。
        var rawPeriod = toText(scriptObj.getParameter({ name: PARAMS.period })).replace(/\//g, '-').trim();
        var match = null;
        var today = new Date();
        var year = 0;
        var month = 0;
        var startDate = null;
        var endDate = null;
        var periodText = EMPTY_VALUE;

        if (!rawPeriod) {
            rawPeriod = getPeriodFromLatestKpiConfig();
        }

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

    /**
     * 方法作用：读取配置中心最近一次保存的统计期间。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：无。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function getPeriodFromLatestKpiConfig() {
        var latestConfig = getLatestKpiConfig();
        var periodValue = EMPTY_VALUE;

        try {
            periodValue = toText(latestConfig.period).replace(/\//g, '-').trim();
            if (periodValue) {
                log.debug('KPI period fallback', 'Using latest config period: ' + periodValue);
            }
            return periodValue;
        } catch (e) {
            log.debug('KPI period fallback failed', getErrorMessage(e));
            return EMPTY_VALUE;
        }
    }

    /**
     * 方法作用：读取并解析指标可视化配置JSON。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：无。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function getMetricConfig() {
        var latestConfig = getLatestKpiConfig();
        var cfg = defaultMetricConfig();
        var parsed = null;

        if (!latestConfig.metricConfigJson) {
            return cfg;
        }

        try {
            parsed = JSON.parse(latestConfig.metricConfigJson);
            cfg.salesOrderAmountField = normalizeAmountField(toText(parsed.salesOrderAmountField));
            cfg.invoiceAmountField = normalizeAmountField(toText(parsed.invoiceAmountField));
            cfg.grossProfitSource = normalizeGrossProfitSource(toText(parsed.grossProfitSource));
            cfg.docRequiredFields = normalizeDocRequiredFields(toText(parsed.docRequiredFields));
            cfg.onlyGenerateWhenActive = parsed.onlyGenerateWhenActive === true || toLowerText(parsed.onlyGenerateWhenActive) === 't' || toLowerText(parsed.onlyGenerateWhenActive) === 'true' || toLowerText(parsed.onlyGenerateWhenActive) === '1';
            return cfg;
        } catch (e) {
            log.debug('KPI metric config parse failed', getErrorMessage(e));
            return cfg;
        }
    }

    /**
     * 方法作用：查询并缓存最新的配置中心记录。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：无。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function getLatestKpiConfig() {
        var result = [];

        if (KPI_CONFIG_CACHE) {
            return KPI_CONFIG_CACHE;
        }

        KPI_CONFIG_CACHE = {
            id: EMPTY_VALUE,
            period: EMPTY_VALUE,
            metricConfigJson: EMPTY_VALUE
        };

        try {
            result = search.create({
                type: KPI_CONFIG_RECORD_TYPE,
                filters: [],
                columns: [
                    search.createColumn({ name: 'internalid', sort: search.Sort.DESC }),
                    search.createColumn({ name: KPI_CONFIG_FIELDS.period }),
                    search.createColumn({ name: KPI_CONFIG_FIELDS.metricConfigJson })
                ]
            }).run().getRange({ start: 0, end: 1 });

            if (result && result.length) {
                KPI_CONFIG_CACHE.id = toText(result[0].getValue({ name: KPI_CONFIG_FIELDS.id }));
                KPI_CONFIG_CACHE.period = toText(result[0].getValue({ name: KPI_CONFIG_FIELDS.period }));
                KPI_CONFIG_CACHE.metricConfigJson = toText(result[0].getValue({ name: KPI_CONFIG_FIELDS.metricConfigJson }));
            }
        } catch (e) {
            log.debug('KPI latest config read failed', getErrorMessage(e));
        }

        return KPI_CONFIG_CACHE;
    }

    function updateKpiExecutionMessage(messageText) {
        var latestConfig = getLatestKpiConfig();
        var configId = toText(latestConfig.id);
        var values = {};

        if (!configId) {
            return;
        }

        values[KPI_CONFIG_FIELDS.lastMessage] = toText(messageText);

        try {
            record.submitFields({
                type: KPI_CONFIG_RECORD_TYPE,
                id: configId,
                values: values
            });
        } catch (e) {
            log.debug('KPI执行结果回写失败', getErrorMessage(e));
        }
    }

    /**
     * 方法作用：从交易/商机/逾期应收来源汇总待计算销售人员。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：periodInfo。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function getTargetSalesRepIds(periodInfo) {
        var salesRepIds = [];
        var ownerFields = getOwnerFieldCandidates();

        // 从多个来源汇总销售人员，避免仅依赖单一单据导致漏算。
        addUniqueValues(salesRepIds, collectSalesRepIdsFromTransaction(TRANSACTION_TYPE.salesOrder, periodInfo));
        addUniqueValues(salesRepIds, collectSalesRepIdsFromTransaction(TRANSACTION_TYPE.invoice, periodInfo));
        addUniqueValues(salesRepIds, collectSalesRepIdsFromTransaction(TRANSACTION_TYPE.estimate, periodInfo));
        addUniqueValues(salesRepIds, collectSalesRepIdsFromOpportunity(periodInfo));
        addUniqueValues(salesRepIds, collectSalesRepIdsFromOverdueInvoice(periodInfo));

        log.debug('销售归属字段候选', '字段: ' + ownerFields.join(','));
        return salesRepIds;
    }

    /**
     * 方法作用：收集并归并数据来源结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：typeId、periodInfo。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function collectSalesRepIdsFromTransaction(typeId, periodInfo) {
        return collectGroupedValuesByOwnerFields(getTransactionOwnerFieldCandidates(typeId), function (ownerFieldId) {
            return search.create({
                type: search.Type.TRANSACTION,
                filters: buildTransactionDateFilters(typeId, periodInfo, [], EMPTY_VALUE, ownerFieldId),
                columns: [
                    search.createColumn({ name: ownerFieldId, summary: search.Summary.GROUP })
                ]
            });
        }, 'transaction:' + typeId, '交易单据-' + typeId);
    }

    /**
     * 方法作用：收集并归并数据来源结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：periodInfo。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function collectSalesRepIdsFromOpportunity(periodInfo) {
        return collectGroupedValuesByOwnerFields(getOpportunityOwnerFieldCandidates(), function (ownerFieldId) {
            return search.create({
                type: 'opportunity',
                filters: buildOpportunityFilters(periodInfo, EMPTY_VALUE, ownerFieldId),
                columns: [
                    search.createColumn({ name: ownerFieldId, summary: search.Summary.GROUP })
                ]
            });
        }, 'opportunity', '商机');
    }

    /**
     * 方法作用：收集并归并数据来源结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：periodInfo。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function collectSalesRepIdsFromOverdueInvoice(periodInfo) {
        return collectGroupedValuesByOwnerFields(getTransactionOwnerFieldCandidates(TRANSACTION_TYPE.invoice), function (ownerFieldId) {
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

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesRepId、periodInfo。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function getSalesOrderMonthlyData(salesRepId, periodInfo) {
        var metricConfig = getMetricConfig();
        var results = getTransactionResultsByOwnerFields(TRANSACTION_TYPE.salesOrder, periodInfo, [
            ['status', 'noneof', SALES_ORDER_CANCELLED_STATUS]
        ], salesRepId, ['internalid', 'amount', 'total', 'entity'], '销售订单');
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
            amount += getPreferredTransactionAmount(result, metricConfig.salesOrderAmountField);
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

    /**
     * 方法作用：计算业务指标并返回标准化结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesOrderData。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function calculateSalesOrderAmount(salesOrderData) {
        return roundNumber(salesOrderData.amount);
    }

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesRepId、periodInfo。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function getInvoiceMonthlyData(salesRepId, periodInfo) {
        var metricConfig = getMetricConfig();
        var results = getTransactionResultsByOwnerFields(TRANSACTION_TYPE.invoice, periodInfo, [], salesRepId, ['internalid', 'amount', 'total'], '发票');
        var amount = 0;
        var i = 0;

        for (i = 0; i < results.length; i += 1) {
            amount += getPreferredTransactionAmount(results[i], metricConfig.invoiceAmountField);
        }

        return {
            amount: roundNumber(amount)
        };
    }

    /**
     * 方法作用：计算业务指标并返回标准化结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：invoiceData。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function calculateInvoiceAmount(invoiceData) {
        return roundNumber(invoiceData.amount);
    }

    /**
     * 方法作用：计算毛利额（当前阶段按配置口径回退为0）。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesRepId、periodInfo。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function calculateGrossProfit(salesRepId, periodInfo) {
        var metricConfig = getMetricConfig();
        var note = EMPTY_VALUE;

        if (metricConfig.grossProfitSource === 'always_zero') {
            return {
                amount: 0,
                note: '毛利额按页面配置为预留口径，本期固定写 0。'
            };
        }

        // 止血策略：当前账套未确认 grossprofit 可用性，第一阶段统一写 0 并保留备注。
        note = '毛利额当前未确认系统 grossprofit 字段口径，本期默认写 0。';

        return {
            amount: 0,
            note: note
        };
    }

    /**
     * 方法作用：计算业务指标并返回标准化结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：grossProfit、invoiceAmount。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function calculateGrossMargin(grossProfit, invoiceAmount) {
        return roundNumber(safeDivide(grossProfit, invoiceAmount) * 100);
    }

    /**
     * 方法作用：计算回款达成率（按客户付款近似口径）。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesRepId、periodInfo、invoiceAmount。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

        // anyof 过滤条件单次有数量限制，按批拆分客户提升稳定性。
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

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesRepId。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：计算业务指标并返回标准化结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesRepId、periodInfo。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：计算业务指标并返回标准化结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesRepId、periodInfo。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：计算业务指标并返回标准化结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesRepId、periodInfo。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function calculateOpportunityFollowRate(salesRepId, periodInfo) {
        return {
            rate: 0,
            note: '商机跟进及时率第一阶段未识别到统一跟进日期字段，本期先返回 0。'
        };
    }

    /**
     * 方法作用：计算业务指标并返回标准化结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesRepId、periodInfo。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesRepId、periodInfo。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：计算业务指标并返回标准化结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesRepId、periodInfo、currentCustomerIds。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesRepId、periodInfo。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：计算业务指标并返回标准化结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesRepId、periodInfo。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：计算单据填写完整率（基于搜索口径）。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesRepId、periodInfo、salesOrderIds。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function calculateDocumentCompleteRate(salesRepId, periodInfo, salesOrderIds) {
        var metricConfig = getMetricConfig();
        var requiredFieldMap = parseRequiredFieldMap(metricConfig.docRequiredFields);
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
            // 使用纯搜索而非 record.load，避免工作流锁单时抛错影响整批统计。
            mainlineDataMap = getSalesOrderMainlineDataMap(salesOrderIds);
            itemCountMap = getSalesOrderItemCountMap(salesOrderIds);

            for (i = 0; i < salesOrderIds.length; i += 1) {
                currentSalesOrderId = salesOrderIds[i];
                currentMainlineData = mainlineDataMap[currentSalesOrderId];
                itemCount = toNumber(itemCountMap[currentSalesOrderId]);

                if (isSalesOrderDocumentComplete(currentMainlineData, itemCount, requiredFieldMap)) {
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

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesOrderIds。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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
                columns: ['internalid', 'entity', 'salesrep', 'trandate', 'amount', 'total']
            }));

            for (i = 0; i < results.length; i += 1) {
                salesOrderId = toText(results[i].getValue({ name: 'internalid' }));
                if (!salesOrderId) {
                    continue;
                }

                dataMap[salesOrderId] = {
                    entityValue: results[i].getValue({ name: 'entity' }),
                    salesRepValue: results[i].getValue({ name: 'salesrep' }),
                    tranDateValue: results[i].getValue({ name: 'trandate' }),
                    amountHasValue: hasSearchValue(results[i].getValue({ name: 'amount' })),
                    totalHasValue: hasSearchValue(results[i].getValue({ name: 'total' }))
                };
            }
        }

        return dataMap;
    }

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesOrderIds。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function getSalesOrderItemCountMap(salesOrderIds) {
        try {
            return getSalesOrderItemCountMapByMode(salesOrderIds, true);
        } catch (e) {
            log.debug('销售订单行数搜索回退', '错误: ' + getErrorMessage(e));
            return getSalesOrderItemCountMapByMode(salesOrderIds, false);
        }
    }

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesOrderIds、useExtraLineFilters。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：searchResult、preferredField。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function getPreferredTransactionAmount(searchResult, preferredField) {
        if (normalizeAmountField(preferredField) === 'total') {
            return toNumberWithFallback(
                searchResult.getValue({ name: 'total' }),
                searchResult.getValue({ name: 'amount' })
            );
        }

        return toNumberWithFallback(
            searchResult.getValue({ name: 'amount' }),
            searchResult.getValue({ name: 'total' })
        );
    }

    /**
     * 方法作用：执行基础类型转换并兜底异常输入。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：value、fallbackValue。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function toNumberWithFallback(value, fallbackValue) {
        var num = toNumber(value);

        if (num !== 0 || hasSearchValue(value)) {
            return num;
        }

        return toNumber(fallbackValue);
    }

    /**
     * 方法作用：封装业务步骤，供KPI统计主流程调用。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：无。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function defaultMetricConfig() {
        return {
            salesOrderAmountField: 'amount',
            invoiceAmountField: 'amount',
            grossProfitSource: 'grossprofit_or_zero',
            docRequiredFields: 'entity,salesrep,trandate,item,amount',
            onlyGenerateWhenActive: false
        };
    }

    /**
     * 方法作用：判断统计月是否存在业务数据，用于“仅当月有业务才生成记录”开关。
     * 关键逻辑：当月销售订单/发票/有效商机/报价单任一存在即视为有业务。
     * 入参：salesRepId、periodInfo、salesOrderData、invoiceData、newOppCount。
     * 返回：Boolean，true 表示当月有业务。
     */
    function hasMonthlyBusinessActivity(salesRepId, periodInfo, salesOrderData, invoiceData, newOppCount) {
        var estimateIds = getEstimateIdsByMonth(salesRepId, periodInfo);
        return (salesOrderData && salesOrderData.ids && salesOrderData.ids.length > 0)
            || (invoiceData && invoiceData.ids && invoiceData.ids.length > 0)
            || toNumber(newOppCount) > 0
            || (estimateIds && estimateIds.length > 0);
    }

    /**
     * 方法作用：标准化输入值并约束到可用范围。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：value。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function normalizeAmountField(value) {
        if (toLowerText(value) === 'total') {
            return 'total';
        }
        return 'amount';
    }

    /**
     * 方法作用：标准化输入值并约束到可用范围。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：value。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function normalizeGrossProfitSource(value) {
        if (toLowerText(value) === 'always_zero') {
            return 'always_zero';
        }
        return 'grossprofit_or_zero';
    }

    /**
     * 方法作用：标准化输入值并约束到可用范围。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：value。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function normalizeDocRequiredFields(value) {
        var normalized = toLowerText(value).replace(/\s+/g, '');
        return normalized || 'entity,salesrep,trandate,item,amount';
    }

    /**
     * 方法作用：解析输入文本并转换为结构化数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：requiredFieldsText。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function parseRequiredFieldMap(requiredFieldsText) {
        var map = {};
        var values = normalizeDocRequiredFields(requiredFieldsText).split(',');
        var i = 0;
        var key = EMPTY_VALUE;

        for (i = 0; i < values.length; i += 1) {
            key = toText(values[i]).trim();
            if (!key) {
                continue;
            }
            map[key] = true;
        }

        return map;
    }

    /**
     * 方法作用：执行布尔判定并返回是/否。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：mainlineData、itemCount、requiredFieldMap。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function isSalesOrderDocumentComplete(mainlineData, itemCount, requiredFieldMap) {
        if (!mainlineData) {
            return false;
        }

        if (requiredFieldMap.entity && !mainlineData.entityValue) {
            return false;
        }

        if (requiredFieldMap.salesrep && !mainlineData.salesRepValue) {
            return false;
        }

        if (requiredFieldMap.trandate && !mainlineData.tranDateValue) {
            return false;
        }

        if (requiredFieldMap.item && !(itemCount > 0)) {
            return false;
        }

        if (requiredFieldMap.amount && !(mainlineData.amountHasValue || mainlineData.totalHasValue)) {
            return false;
        }

        if (requiredFieldMap.total && !(mainlineData.totalHasValue || mainlineData.amountHasValue)) {
            return false;
        }

        return true;
    }

    /**
     * 方法作用：计算业务指标并返回标准化结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：无。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function calculateTotalScore() {
        return {
            score: 0,
            note: 'KPI总分公式尚未确定，本期默认写 0。'
        };
    }

    /**
     * 方法作用：按销售+期间幂等写入KPI结果记录。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：periodInfo、resultData。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：查找同销售同期间的已有结果记录。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：salesRepId、periodText。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：获取销售归属字段候选列表。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：无。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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
    /**
     * 方法作用：获取商机可用归属字段候选列表。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：无。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function getOpportunityOwnerFieldCandidates() {
        var ownerFields = getOwnerFieldCandidates();
        var candidates = [];
        var i = 0;
        var fieldId = EMPTY_VALUE;

        for (i = 0; i < ownerFields.length; i += 1) {
            fieldId = toLowerText(ownerFields[i]);
            if (fieldId === 'salesrep' || fieldId === 'employee') {
                addUniqueValue(candidates, ownerFields[i]);
            }
        }

        if (!candidates.length) {
            candidates.push('salesrep');
        }

        return candidates;
    }
    function getTransactionOwnerFieldCandidates(typeId) {
        var ownerFields = getOwnerFieldCandidates();
        var candidates = [];
        var i = 0;
        var fieldId = EMPTY_VALUE;

        for (i = 0; i < ownerFields.length; i += 1) {
            fieldId = toLowerText(ownerFields[i]);
            if (fieldId === 'employee') {
                continue;
            }
            addUniqueValue(candidates, ownerFields[i]);
        }

        if (!candidates.length) {
            candidates.push('salesrep');
        }

        return candidates;
    }
    /**
     * 方法作用：收集并归并数据来源结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：ownerFields、searchFactory、cacheKey、sourceLabel。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：typeId、periodInfo、extraFilters、salesRepId、columns、sourceLabel。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function getTransactionResultsByOwnerFields(typeId, periodInfo, extraFilters, salesRepId, columns, sourceLabel) {
        return collectResultsByOwnerFields(getTransactionOwnerFieldCandidates(typeId), function (ownerFieldId, normalizedColumns) {
            return search.create({
                type: search.Type.TRANSACTION,
                filters: buildTransactionDateFilters(typeId, periodInfo, extraFilters, salesRepId, ownerFieldId),
                columns: normalizedColumns
            });
        }, columns, 'transaction:' + typeId, sourceLabel);
    }

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：typeId、beforeDateText、extraFilters、salesRepId、columns、sourceLabel。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function getTransactionResultsBeforeDateByOwnerFields(typeId, beforeDateText, extraFilters, salesRepId, columns, sourceLabel) {
        return collectResultsByOwnerFields(getTransactionOwnerFieldCandidates(typeId), function (ownerFieldId, normalizedColumns) {
            return search.create({
                type: search.Type.TRANSACTION,
                filters: buildTransactionBeforeDateFilters(typeId, beforeDateText, extraFilters, salesRepId, ownerFieldId),
                columns: normalizedColumns
            });
        }, columns, 'transaction:' + typeId, sourceLabel);
    }

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：periodInfo、salesRepId、columns、sourceLabel。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function getOpportunityResultsByOwnerFields(periodInfo, salesRepId, columns, sourceLabel) {
        return collectResultsByOwnerFields(getOpportunityOwnerFieldCandidates(), function (ownerFieldId, normalizedColumns) {
            return search.create({
                type: 'opportunity',
                filters: buildOpportunityFilters(periodInfo, salesRepId, ownerFieldId),
                columns: normalizedColumns
            });
        }, columns, 'opportunity', sourceLabel);
    }

    /**
     * 方法作用：收集并归并数据来源结果。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：ownerFields、searchFactory、columns、cacheKey、sourceLabel。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：ownerFieldId、searchFactory、sourceLabel、fromCache。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：ownerFieldId、searchFactory、normalizedColumns、sourceLabel、fromCache。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：合并数据并进行去重处理。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：targetResults、seenIds、sourceResults。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：确保关键条件满足并补齐默认值。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：columns。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function ensureInternalIdColumn(columns) {
        var normalizedColumns = columns ? columns.slice(0) : [];

        if (!hasColumn(normalizedColumns, 'internalid')) {
            normalizedColumns.push('internalid');
        }

        return normalizedColumns;
    }

    /**
     * 方法作用：判断目标数据是否满足存在性条件。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：columns、fieldName。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function hasColumn(columns, fieldName) {
        var i = 0;

        for (i = 0; i < columns.length; i += 1) {
            if (getColumnName(columns[i]) === fieldName) {
                return true;
            }
        }

        return false;
    }

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：column。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function getColumnName(column) {
        if (typeof column === 'string') {
            return column;
        }

        if (column && column.name) {
            return column.name;
        }

        return EMPTY_VALUE;
    }

    /**
     * 方法作用：构建查询条件或参数对象。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：typeId、periodInfo、extraFilters、salesRepId、ownerFieldId。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：构建查询条件或参数对象。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：typeId、beforeDateText、extraFilters、salesRepId、ownerFieldId。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：构建查询条件或参数对象。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：periodInfo、salesRepId、ownerFieldId。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：transactionRecord。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：无。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：employeeId。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：searchObj。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：读取并返回查询结果或配置数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：results、fieldName。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：封装业务步骤，供KPI统计主流程调用。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：text、keywords。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function containsAnyKeyword(text, keywords) {
        var i = 0;

        for (i = 0; i < keywords.length; i += 1) {
            if (text.indexOf(keywords[i]) > -1) {
                return true;
            }
        }

        return false;
    }

    /**
     * 方法作用：解析输入文本并转换为结构化数据。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：value。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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

    /**
     * 方法作用：格式化日期或文本用于查询/展示。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：dateValue。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function formatDateValue(dateValue) {
        return format.format({
            value: dateValue,
            type: format.Type.DATE
        });
    }

    /**
     * 方法作用：将集合按批次拆分用于分段查询。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：values、batchSize。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function splitArray(values, batchSize) {
        var batches = [];
        var index = 0;

        for (index = 0; index < values.length; index += batchSize) {
            batches.push(values.slice(index, index + batchSize));
        }

        return batches;
    }

    /**
     * 方法作用：追加提示信息并保持结果可读。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：notes、note。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function appendNote(notes, note) {
        if (!note) {
            return;
        }
        if (notes.indexOf(note) === -1) {
            notes.push(note);
        }
    }

    /**
     * 方法作用：拼接多条说明文本为单一输出。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：notes。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function joinNotes(notes) {
        if (!notes || !notes.length) {
            return EMPTY_VALUE;
        }
        return notes.join('；');
    }

    /**
     * 方法作用：向集合追加数据并处理去重。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：target、values。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function addUniqueValues(target, values) {
        var i = 0;

        for (i = 0; i < values.length; i += 1) {
            addUniqueValue(target, values[i]);
        }
    }

    /**
     * 方法作用：向集合追加数据并处理去重。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：target、value。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function addUniqueValue(target, value) {
        if (value && target.indexOf(value) === -1) {
            target.push(value);
        }
    }

    /**
     * 方法作用：执行数组到映射的转换处理。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：values。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function arrayToMap(values) {
        var map = {};
        var i = 0;

        for (i = 0; i < values.length; i += 1) {
            map[values[i]] = true;
        }

        return map;
    }

    /**
     * 方法作用：执行安全数学计算并处理除零场景。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：numerator、denominator。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function safeDivide(numerator, denominator) {
        if (!denominator) {
            return 0;
        }
        return numerator / denominator;
    }

    /**
     * 方法作用：执行数值四舍五入并统一精度。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：value。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function roundNumber(value) {
        var numberValue = toNumber(value);
        return Math.round(numberValue * 100) / 100;
    }

    /**
     * 方法作用：判断目标数据是否满足存在性条件。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：value。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function hasSearchValue(value) {
        return value !== null && value !== undefined && toText(value) !== EMPTY_VALUE;
    }

    /**
     * 方法作用：执行基础类型转换并兜底异常输入。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：value。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function toNumber(value) {
        var numberValue = Number(value);
        if (isNaN(numberValue)) {
            return 0;
        }
        return numberValue;
    }

    /**
     * 方法作用：执行基础类型转换并兜底异常输入。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：value。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function toText(value) {
        if (value === null || value === undefined) {
            return EMPTY_VALUE;
        }
        return String(value);
    }

    /**
     * 方法作用：执行基础类型转换并兜底异常输入。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：value。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function toLowerText(value) {
        return toText(value).toLowerCase();
    }

    /**
     * 方法作用：补零格式化数字为固定宽度文本。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：numberValue。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
    function padLeft(numberValue) {
        if (numberValue < 10) {
            return '0' + numberValue;
        }
        return String(numberValue);
    }

    /**
     * 方法作用：统一格式化异常信息用于日志输出。
     * 关键逻辑：在当前阶段按照统一口径处理异常与空值，保证批处理稳定执行。
     * 入参：errorObj。
     * 返回：按方法职责返回计算值、列表、映射或状态结果。
     */
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
