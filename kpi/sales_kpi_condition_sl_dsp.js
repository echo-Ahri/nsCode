/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/ui/message', 'N/record', 'N/search', 'N/task', 'N/runtime', 'N/redirect', 'N/log'],
function (serverWidget, uiMessage, record, search, task, runtime, redirect, log) {
    var CONFIG_RECORD_TYPE = 'customrecord_skm_cfg_dsp';

    var CONFIG_FIELDS = {
        name: 'custrecord_skm_cfg_name',
        period: 'custrecord_skm_cfg_period',
        invalidKeywords: 'custrecord_skm_cfg_invalid_kw',
        ownerFields: 'custrecord_skm_cfg_owner_fields',
        metricConfigJson: 'custrecord_skm_cfg_metric_json',
        metricSoAmountField: 'custrecord_skm_cfg_m_so_amount',
        metricInvoiceAmountField: 'custrecord_skm_cfg_m_inv_amount',
        metricGrossProfitSource: 'custrecord_skm_cfg_m_gp_source',
        metricQuoteMode: 'custrecord_skm_cfg_m_quote_mode',
        metricCollectionMode: 'custrecord_skm_cfg_m_collection_mode',
        metricDocRequiredFields: 'custrecord_skm_cfg_m_doc_req_fields',
        metricOnlyGenerateWhenActive: 'custrecord_skm_cfg_m_only_active',
        contractRecType: 'custrecord_skm_cfg_contract_rec_type',
        contractOwnerField: 'custrecord_skm_cfg_contract_owner',
        contractDueField: 'custrecord_skm_cfg_contract_due',
        contractUpdateField: 'custrecord_skm_cfg_contract_update',
        submitNow: 'custrecord_skm_cfg_submit_now',
        lastTaskId: 'custrecord_skm_cfg_last_taskid',
        lastMessage: 'custrecord_skm_cfg_last_msg'
    };

    var KPI_TASK_TARGET = {
        scriptId: 'customscript_skm_calc_ss_dsp',
        deploymentId: 'customdeploy_skm_calc_ss_dsp'
    };

    var KPI_PARAM_IDS = {
        period: 'custscript_skm_period',
        invalidKeywords: 'custscript_skm_opp_invalid_keywords',
        ownerFields: 'custscript_skm_owner_fields',
        contractRecType: 'custscript_skm_contract_rec_type',
        contractOwnerField: 'custscript_skm_contract_owner_field',
        contractDueField: 'custscript_skm_contract_due_field',
        contractUpdateField: 'custscript_skm_contract_update_field'
    };

    function onRequest(context) {
        if (context.request.method === 'GET') {
            renderForm(context, null);
            return;
        }
        handlePost(context);
    }

    function handlePost(context) {
        var req = context.request;
        var action = toText(req.parameters.custpage_action) || 'save_run';
        var configId = saveConfig(req.parameters, action);
        var taskId = '';
        var message = action === 'save_only' ? '已保存' : '执行中...';

        if (action === 'save_run') {
            try {
                taskId = submitKpiTask(req.parameters);
                message = '执行中...';
            } catch (submitError) {
                if (isInQueueError(submitError)) {
                    message = '执行中...';
                } else {
                    throw submitError;
                }
            }
        }

        if (configId) {
            record.submitFields({
                type: CONFIG_RECORD_TYPE,
                id: configId,
                values: buildSubmitFieldValues(taskId, message)
            });
        }

        redirect.toSuitelet({
            scriptId: runtime.getCurrentScript().id,
            deploymentId: runtime.getCurrentScript().deploymentId,
            parameters: {
                configid: configId,
                result: message,
                taskid: taskId
            }
        });
    }

    function renderForm(context, overrideValues) {
        var req = context.request;
        var configId = toText(req.parameters.configid);
        var result = toText(req.parameters.result);
        var taskId = toText(req.parameters.taskid);
        var values = overrideValues || loadConfigValues(configId) || defaultValues();

        var form = serverWidget.createForm({ title: '按指标条件执行KPI统计' });
        form.clientScriptModulePath = './sales_kpi_condition_sl_dsp_cs.js';

        if (result === '已保存') {
            form.addPageInitMessage({
                type: uiMessage.Type.CONFIRMATION,
                title: '已保存',
                message: result
            });
            addAutoRefreshScript(form);
        }

        addMainFields(form, values);
        addMetricRuleFields(form, values);
        addActionFields(form, values, taskId, configId);

        form.addSubmitButton({ label: '保存' });
        context.response.writePage(form);
    }

    function addMainFields(form, values) {
        form.addFieldGroup({ id: 'custpage_grp_base', label: 'KPI指标条件' });

        var nameFld = form.addField({ id: 'custpage_cfg_name', type: serverWidget.FieldType.TEXT, label: '配置名称', container: 'custpage_grp_base' });
        nameFld.isMandatory = true;
        nameFld.defaultValue = values.name;

        var periodFld = form.addField({ id: 'custpage_period', type: serverWidget.FieldType.TEXT, label: '统计期间 (YYYY-MM)', container: 'custpage_grp_base' });
        periodFld.defaultValue = values.period;

        var invalidFld = form.addField({ id: 'custpage_invalid_kw', type: serverWidget.FieldType.TEXTAREA, label: '无效商机关键词', container: 'custpage_grp_base' });
        invalidFld.defaultValue = values.invalidKeywords;

        var ownerFld = form.addField({ id: 'custpage_owner_fields', type: serverWidget.FieldType.TEXT, label: '归属字段(逗号分隔)', container: 'custpage_grp_base' });
        ownerFld.defaultValue = values.ownerFields;

        var cTypeFld = form.addField({ id: 'custpage_contract_type', type: serverWidget.FieldType.TEXT, label: '合同记录类型', container: 'custpage_grp_base' });
        cTypeFld.defaultValue = values.contractRecType;

        var cOwnerFld = form.addField({ id: 'custpage_contract_owner', type: serverWidget.FieldType.TEXT, label: '合同归属字段ID', container: 'custpage_grp_base' });
        cOwnerFld.defaultValue = values.contractOwnerField;

        var cDueFld = form.addField({ id: 'custpage_contract_due', type: serverWidget.FieldType.TEXT, label: '合同到期字段ID', container: 'custpage_grp_base' });
        cDueFld.defaultValue = values.contractDueField;

        var cUpdFld = form.addField({ id: 'custpage_contract_update', type: serverWidget.FieldType.TEXT, label: '合同续签字段ID', container: 'custpage_grp_base' });
        cUpdFld.defaultValue = values.contractUpdateField;

        var hiddenIdFld = form.addField({ id: 'custpage_cfg_id', type: serverWidget.FieldType.TEXT, label: '配置ID', container: 'custpage_grp_base' });
        hiddenIdFld.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
        hiddenIdFld.defaultValue = values.id;
    }

    function addMetricRuleFields(form, values) {
        var metricConfig = values.metricConfig || defaultMetricConfig();

        form.addFieldGroup({ id: 'custpage_grp_metric', label: '指标规则可视化配置' });

        var soAmountFld = form.addField({ id: 'custpage_metric_so_amount_field', type: serverWidget.FieldType.SELECT, label: '销售订单金额字段', container: 'custpage_grp_metric' });
        soAmountFld.addSelectOption({ value: 'amount', text: 'amount(推荐)' });
        soAmountFld.addSelectOption({ value: 'total', text: 'total' });
        soAmountFld.defaultValue = toText(metricConfig.salesOrderAmountField || 'amount');

        var invoiceAmountFld = form.addField({ id: 'custpage_metric_invoice_amount_field', type: serverWidget.FieldType.SELECT, label: '开票金额字段', container: 'custpage_grp_metric' });
        invoiceAmountFld.addSelectOption({ value: 'amount', text: 'amount(推荐)' });
        invoiceAmountFld.addSelectOption({ value: 'total', text: 'total' });
        invoiceAmountFld.defaultValue = toText(metricConfig.invoiceAmountField || 'amount');

        var grossProfitFld = form.addField({ id: 'custpage_metric_gross_profit_source', type: serverWidget.FieldType.SELECT, label: '毛利额口径', container: 'custpage_grp_metric' });
        grossProfitFld.addSelectOption({ value: 'grossprofit_or_zero', text: '优先 grossprofit，失败写0' });
        grossProfitFld.addSelectOption({ value: 'always_zero', text: '固定0(预留)' });
        grossProfitFld.defaultValue = toText(metricConfig.grossProfitSource || 'grossprofit_or_zero');

        var quoteModeFld = form.addField({ id: 'custpage_metric_quote_mode', type: serverWidget.FieldType.SELECT, label: '报价转订单率口径', container: 'custpage_grp_metric' });
        quoteModeFld.addSelectOption({ value: 'createdfrom_approx', text: 'createdfrom近似口径(第一阶段)' });
        quoteModeFld.defaultValue = toText(metricConfig.quoteToSoMode || 'createdfrom_approx');

        var collectionModeFld = form.addField({ id: 'custpage_metric_collection_mode', type: serverWidget.FieldType.SELECT, label: '回款达成率口径', container: 'custpage_grp_metric' });
        collectionModeFld.addSelectOption({ value: 'customer_payment_over_invoice', text: '当月付款/当月开票(第一阶段)' });
        collectionModeFld.defaultValue = toText(metricConfig.collectionMode || 'customer_payment_over_invoice');

        var docRequiredFld = form.addField({ id: 'custpage_metric_doc_required_fields', type: serverWidget.FieldType.TEXT, label: '单据完整率必填项(逗号分隔)', container: 'custpage_grp_metric' });
        docRequiredFld.defaultValue = toText(metricConfig.docRequiredFields || 'entity,salesrep,trandate,item,amount');

        var hiddenMetricJsonFld = form.addField({ id: 'custpage_metric_json', type: serverWidget.FieldType.LONGTEXT, label: '指标规则JSON', container: 'custpage_grp_metric' });
        hiddenMetricJsonFld.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
        hiddenMetricJsonFld.defaultValue = toText(values.metricConfigJson || stringifyMetricConfig(metricConfig));
    }

    function addActionFields(form, values, taskId, configId) {
        form.addFieldGroup({ id: 'custpage_grp_action', label: '执行操作' });

        addConfigSourceField(form, configId);

        var actionFld = form.addField({ id: 'custpage_action', type: serverWidget.FieldType.SELECT, label: '操作', container: 'custpage_grp_action' });
        actionFld.addSelectOption({ value: 'save_run', text: '保存并提交KPI统计任务' });
        actionFld.addSelectOption({ value: 'save_only', text: '仅保存' });
        actionFld.defaultValue = values.submitNow === 'F' ? 'save_only' : 'save_run';

        var tipFld = form.addField({ id: 'custpage_tip', type: serverWidget.FieldType.INLINEHTML, label: '说明', container: 'custpage_grp_action' });
        tipFld.defaultValue = '<div style="padding:8px 0;">本页面用于保存KPI指标条件，并可按当前条件直接提交KPI统计脚本。</div>';

        var onlyWhenActiveFld = form.addField({ id: 'custpage_metric_only_generate_when_active', type: serverWidget.FieldType.CHECKBOX, label: '仅当月有业务才生成记录', container: 'custpage_grp_action' });
        onlyWhenActiveFld.defaultValue = values.metricConfig && values.metricConfig.onlyGenerateWhenActive ? 'T' : 'F';

        if (taskId) {
            var taskFld = form.addField({ id: 'custpage_taskid_view', type: serverWidget.FieldType.TEXT, label: '最近提交任务ID', container: 'custpage_grp_action' });
            taskFld.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
            taskFld.defaultValue = taskId;
        }

        var execResultFld = form.addField({ id: 'custpage_exec_result_view', type: serverWidget.FieldType.TEXTAREA, label: '执行结果', container: 'custpage_grp_action' });
        execResultFld.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
        execResultFld.defaultValue = resolveExecutionResult(values);
    }

    function addConfigSourceField(form, configId) {
        var sourceFld = form.addField({
            id: 'custpage_cfg_source',
            type: serverWidget.FieldType.SELECT,
            label: '来源配置',
            container: 'custpage_grp_action'
        });
        var configs = listConfigSources();
        var i = 0;
        sourceFld.addSelectOption({ value: '', text: '' });
        for (i = 0; i < configs.length; i += 1) {
            sourceFld.addSelectOption({
                value: configs[i].id,
                text: configs[i].name
            });
        }
        sourceFld.defaultValue = toText(configId);

        var sourceScriptFld = form.addField({
            id: 'custpage_cfg_source_script',
            type: serverWidget.FieldType.INLINEHTML,
            label: ' '
        });
        sourceScriptFld.defaultValue = '';
    }

    function listConfigSources() {
        var rows = search.create({
            type: CONFIG_RECORD_TYPE,
            filters: [],
            columns: [
                search.createColumn({ name: CONFIG_FIELDS.name }),
                search.createColumn({ name: 'internalid', sort: search.Sort.DESC })
            ]
        }).run().getRange({ start: 0, end: 1000 }) || [];
        var out = [];
        var i = 0;
        var id = '';
        var name = '';

        for (i = 0; i < rows.length; i += 1) {
            id = toText(rows[i].getValue({ name: 'internalid' }));
            name = toText(rows[i].getValue({ name: CONFIG_FIELDS.name })) || ('配置#' + id);
            if (id) {
                out.push({ id: id, name: name });
            }
        }
        return out;
    }

    function addAutoRefreshScript(form) {
        var refreshFld = form.addField({
            id: 'custpage_auto_refresh',
            type: serverWidget.FieldType.INLINEHTML,
            label: ' '
        });
        refreshFld.defaultValue = '<script>(function(){setTimeout(function(){try{var u=new URL(window.location.href);u.searchParams.delete("result");window.location.replace(u.toString());}catch(e){window.location.reload();}},800);}());</script>';
    }

    function saveConfig(params, action) {
        var id = toText(params.custpage_cfg_id);
        var rec = null;
        var configName = toText(params.custpage_cfg_name) || 'KPI配置';
        var metricConfig = buildMetricConfigFromParams(params);
        var saveOnly = action === 'save_only';

        if (id) {
            rec = record.load({ type: CONFIG_RECORD_TYPE, id: id, isDynamic: false });
            if (saveOnly && hasConfigParamDifference(rec, params, metricConfig)) {
                rec = record.create({ type: CONFIG_RECORD_TYPE, isDynamic: false });
            }
        } else {
            rec = record.create({ type: CONFIG_RECORD_TYPE, isDynamic: false });
        }

        rec.setValue({ fieldId: CONFIG_FIELDS.name, value: configName });
        try {
            rec.setValue({ fieldId: 'name', value: configName });
        } catch (ignore) {
            log.debug('name field not set', getErrorMessage(ignore));
        }

        rec.setValue({ fieldId: CONFIG_FIELDS.period, value: toText(params.custpage_period) });
        rec.setValue({ fieldId: CONFIG_FIELDS.invalidKeywords, value: toText(params.custpage_invalid_kw) });
        rec.setValue({ fieldId: CONFIG_FIELDS.ownerFields, value: toText(params.custpage_owner_fields) });

        rec.setValue({ fieldId: CONFIG_FIELDS.metricConfigJson, value: stringifyMetricConfig(metricConfig) });
        rec.setValue({ fieldId: CONFIG_FIELDS.metricSoAmountField, value: toText(metricConfig.salesOrderAmountField) });
        rec.setValue({ fieldId: CONFIG_FIELDS.metricInvoiceAmountField, value: toText(metricConfig.invoiceAmountField) });
        rec.setValue({ fieldId: CONFIG_FIELDS.metricGrossProfitSource, value: toText(metricConfig.grossProfitSource) });
        rec.setValue({ fieldId: CONFIG_FIELDS.metricQuoteMode, value: toText(metricConfig.quoteToSoMode) });
        rec.setValue({ fieldId: CONFIG_FIELDS.metricCollectionMode, value: toText(metricConfig.collectionMode) });
        rec.setValue({ fieldId: CONFIG_FIELDS.metricDocRequiredFields, value: toText(metricConfig.docRequiredFields) });
        rec.setValue({ fieldId: CONFIG_FIELDS.metricOnlyGenerateWhenActive, value: metricConfig.onlyGenerateWhenActive === true });

        rec.setValue({ fieldId: CONFIG_FIELDS.contractRecType, value: toText(params.custpage_contract_type) });
        rec.setValue({ fieldId: CONFIG_FIELDS.contractOwnerField, value: toText(params.custpage_contract_owner) });
        rec.setValue({ fieldId: CONFIG_FIELDS.contractDueField, value: toText(params.custpage_contract_due) });
        rec.setValue({ fieldId: CONFIG_FIELDS.contractUpdateField, value: toText(params.custpage_contract_update) });
        rec.setValue({ fieldId: CONFIG_FIELDS.submitNow, value: toText(params.custpage_action) !== 'save_only' });

        return rec.save({ enableSourcing: false, ignoreMandatoryFields: false });
    }

    function hasConfigParamDifference(rec, params, metricConfig) {
        var currentMetricConfig = {
            salesOrderAmountField: normalizeAmountField(toText(rec.getValue({ fieldId: CONFIG_FIELDS.metricSoAmountField }))),
            invoiceAmountField: normalizeAmountField(toText(rec.getValue({ fieldId: CONFIG_FIELDS.metricInvoiceAmountField }))),
            grossProfitSource: normalizeGrossProfitSource(toText(rec.getValue({ fieldId: CONFIG_FIELDS.metricGrossProfitSource }))),
            collectionMode: 'customer_payment_over_invoice',
            quoteToSoMode: 'createdfrom_approx',
            docRequiredFields: normalizeDocRequiredFields(toText(rec.getValue({ fieldId: CONFIG_FIELDS.metricDocRequiredFields }))),
            onlyGenerateWhenActive: rec.getValue({ fieldId: CONFIG_FIELDS.metricOnlyGenerateWhenActive }) === true
        };

        if (toText(rec.getValue({ fieldId: CONFIG_FIELDS.name })) !== (toText(params.custpage_cfg_name) || 'KPI配置')) {
            return true;
        }
        if (normalizePeriodText(toText(rec.getValue({ fieldId: CONFIG_FIELDS.period }))) !== normalizePeriodText(toText(params.custpage_period))) {
            return true;
        }
        if (toText(rec.getValue({ fieldId: CONFIG_FIELDS.invalidKeywords })) !== toText(params.custpage_invalid_kw)) {
            return true;
        }
        if (toText(rec.getValue({ fieldId: CONFIG_FIELDS.ownerFields })) !== toText(params.custpage_owner_fields)) {
            return true;
        }
        if (toText(rec.getValue({ fieldId: CONFIG_FIELDS.contractRecType })) !== toText(params.custpage_contract_type)) {
            return true;
        }
        if (toText(rec.getValue({ fieldId: CONFIG_FIELDS.contractOwnerField })) !== toText(params.custpage_contract_owner)) {
            return true;
        }
        if (toText(rec.getValue({ fieldId: CONFIG_FIELDS.contractDueField })) !== toText(params.custpage_contract_due)) {
            return true;
        }
        if (toText(rec.getValue({ fieldId: CONFIG_FIELDS.contractUpdateField })) !== toText(params.custpage_contract_update)) {
            return true;
        }
        if (stringifyMetricConfig(currentMetricConfig) !== stringifyMetricConfig(metricConfig)) {
            return true;
        }

        return false;
    }

    function submitKpiTask(params) {
        var taskParams = buildKpiParams(params);
        var taskObj = task.create({
            taskType: task.TaskType.SCHEDULED_SCRIPT,
            scriptId: KPI_TASK_TARGET.scriptId,
            deploymentId: KPI_TASK_TARGET.deploymentId,
            params: taskParams
        });
        var taskId = taskObj.submit();
        log.debug('提交KPI任务成功', 'taskId=' + taskId);
        return taskId;
    }

    function isInQueueError(errorObj) {
        var msg = toText(errorObj && (errorObj.message || errorObj.details || errorObj));
        var code = toText(errorObj && errorObj.name);
        return msg.indexOf('INQUEUE') > -1 || code === 'FAILED_TO_SUBMIT_JOB_REQUEST_1';
    }

    function buildKpiParams(params) {
        var values = {};
        assignIfPresent(values, KPI_PARAM_IDS.period, normalizePeriodText(toText(params.custpage_period)));
        assignIfPresent(values, KPI_PARAM_IDS.invalidKeywords, toText(params.custpage_invalid_kw));
        assignIfPresent(values, KPI_PARAM_IDS.ownerFields, toText(params.custpage_owner_fields));
        assignIfPresent(values, KPI_PARAM_IDS.contractRecType, toText(params.custpage_contract_type));
        assignIfPresent(values, KPI_PARAM_IDS.contractOwnerField, toText(params.custpage_contract_owner));
        assignIfPresent(values, KPI_PARAM_IDS.contractDueField, toText(params.custpage_contract_due));
        assignIfPresent(values, KPI_PARAM_IDS.contractUpdateField, toText(params.custpage_contract_update));
        return values;
    }

    function normalizePeriodText(periodText) {
        var text = toText(periodText).trim().replace(/\//g, '-');
        var match = /^(\d{4})-(\d{1,2})$/.exec(text);
        var month = 0;
        if (!match) {
            return text;
        }
        month = parseInt(match[2], 10);
        if (month < 1 || month > 12) {
            return text;
        }
        return match[1] + '-' + (month < 10 ? ('0' + month) : String(month));
    }

    function assignIfPresent(container, key, value) {
        if (value !== '') {
            container[key] = value;
        }
    }

    function buildSubmitFieldValues(taskId, message) {
        var values = {};
        values[CONFIG_FIELDS.lastTaskId] = toText(taskId);
        values[CONFIG_FIELDS.lastMessage] = toText(message);
        return values;
    }

    function loadConfigValues(configId) {
        if (configId) {
            return loadConfigById(configId);
        }
        return loadLatestConfig();
    }

    function loadConfigById(configId) {
        try {
            var rec = record.load({ type: CONFIG_RECORD_TYPE, id: configId, isDynamic: false });
            return mapRecordToValues(rec, configId);
        } catch (e) {
            log.error('加载配置失败', getErrorMessage(e));
            return null;
        }
    }

    function loadLatestConfig() {
        var result = search.create({
            type: CONFIG_RECORD_TYPE,
            filters: [],
            columns: [search.createColumn({ name: 'internalid', sort: search.Sort.DESC })]
        }).run().getRange({ start: 0, end: 1 });
        if (!result || !result.length) {
            return null;
        }
        return loadConfigById(toText(result[0].getValue({ name: 'internalid' })));
    }

    function mapRecordToValues(rec, id) {
        var metricConfigJson = toText(rec.getValue({ fieldId: CONFIG_FIELDS.metricConfigJson }));
        var metricConfig = parseMetricConfig(metricConfigJson);
        metricConfig.salesOrderAmountField = normalizeAmountField(toText(rec.getValue({ fieldId: CONFIG_FIELDS.metricSoAmountField })) || metricConfig.salesOrderAmountField);
        metricConfig.invoiceAmountField = normalizeAmountField(toText(rec.getValue({ fieldId: CONFIG_FIELDS.metricInvoiceAmountField })) || metricConfig.invoiceAmountField);
        metricConfig.grossProfitSource = normalizeGrossProfitSource(toText(rec.getValue({ fieldId: CONFIG_FIELDS.metricGrossProfitSource })) || metricConfig.grossProfitSource);
        metricConfig.quoteToSoMode = toText(rec.getValue({ fieldId: CONFIG_FIELDS.metricQuoteMode })) || metricConfig.quoteToSoMode;
        metricConfig.collectionMode = toText(rec.getValue({ fieldId: CONFIG_FIELDS.metricCollectionMode })) || metricConfig.collectionMode;
        metricConfig.docRequiredFields = normalizeDocRequiredFields(toText(rec.getValue({ fieldId: CONFIG_FIELDS.metricDocRequiredFields })) || metricConfig.docRequiredFields);
        metricConfig.onlyGenerateWhenActive = rec.getValue({ fieldId: CONFIG_FIELDS.metricOnlyGenerateWhenActive }) === true;

        return {
            id: toText(id || rec.id),
            name: toText(rec.getValue({ fieldId: CONFIG_FIELDS.name })),
            period: toText(rec.getValue({ fieldId: CONFIG_FIELDS.period })),
            invalidKeywords: toText(rec.getValue({ fieldId: CONFIG_FIELDS.invalidKeywords })),
            ownerFields: toText(rec.getValue({ fieldId: CONFIG_FIELDS.ownerFields })),
            metricConfigJson: stringifyMetricConfig(metricConfig),
            metricConfig: metricConfig,
            contractRecType: toText(rec.getValue({ fieldId: CONFIG_FIELDS.contractRecType })),
            contractOwnerField: toText(rec.getValue({ fieldId: CONFIG_FIELDS.contractOwnerField })),
            contractDueField: toText(rec.getValue({ fieldId: CONFIG_FIELDS.contractDueField })),
            contractUpdateField: toText(rec.getValue({ fieldId: CONFIG_FIELDS.contractUpdateField })),
            submitNow: rec.getValue({ fieldId: CONFIG_FIELDS.submitNow }) ? 'T' : 'F',
            lastTaskId: toText(rec.getValue({ fieldId: CONFIG_FIELDS.lastTaskId })),
            lastMessage: toText(rec.getValue({ fieldId: CONFIG_FIELDS.lastMessage }))
        };
    }

    function defaultValues() {
        return {
            id: '',
            name: 'KPI配置',
            period: '',
            invalidKeywords: '关闭丢失,无效,closed lost,invalid',
            ownerFields: 'custbody_salesman,salesrep,employee',
            metricConfigJson: stringifyMetricConfig(defaultMetricConfig()),
            metricConfig: defaultMetricConfig(),
            contractRecType: 'customrecord_document_schedule_form',
            contractOwnerField: '',
            contractDueField: '',
            contractUpdateField: '',
            submitNow: 'T',
            lastTaskId: '',
            lastMessage: ''
        };
    }

    function resolveExecutionResult(values) {
        var submitNow = toText(values && values.submitNow);
        var taskId = toText(values && values.lastTaskId);
        var lastMessage = toText(values && values.lastMessage);
        var statusObj = null;
        var statusText = '';

        if (submitNow === 'F') {
            return '已保存';
        }

        if (lastMessage.indexOf('KPI月度统计完成') === 0 || lastMessage.indexOf('执行失败') === 0) {
            return lastMessage;
        }

        if (!taskId) {
            return lastMessage || '';
        }

        try {
            statusObj = task.checkStatus({ taskId: taskId });
            statusText = toText(statusObj && statusObj.status).toUpperCase();
            if (statusText === 'FAILED') {
                return '执行失败, 请查看日志';
            }
            if (statusText === 'COMPLETE') {
                return lastMessage || 'KPI月度统计完成';
            }
            return lastMessage || '执行中...';
        } catch (e) {
            log.debug('检查任务状态失败', getErrorMessage(e));
            return lastMessage || '执行中...';
        }
    }

    function toText(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value);
    }

    function defaultMetricConfig() {
        return {
            salesOrderAmountField: 'amount',
            invoiceAmountField: 'amount',
            grossProfitSource: 'grossprofit_or_zero',
            collectionMode: 'customer_payment_over_invoice',
            quoteToSoMode: 'createdfrom_approx',
            docRequiredFields: 'entity,salesrep,trandate,item,amount',
            onlyGenerateWhenActive: false
        };
    }

    function buildMetricConfigFromParams(params) {
        return {
            salesOrderAmountField: normalizeAmountField(toText(params.custpage_metric_so_amount_field)),
            invoiceAmountField: normalizeAmountField(toText(params.custpage_metric_invoice_amount_field)),
            grossProfitSource: normalizeGrossProfitSource(toText(params.custpage_metric_gross_profit_source)),
            collectionMode: 'customer_payment_over_invoice',
            quoteToSoMode: 'createdfrom_approx',
            docRequiredFields: normalizeDocRequiredFields(toText(params.custpage_metric_doc_required_fields)),
            onlyGenerateWhenActive: isChecked(params.custpage_metric_only_generate_when_active)
        };
    }

    function parseMetricConfig(metricConfigJson) {
        var parsed = null;
        var cfg = defaultMetricConfig();
        if (!metricConfigJson) {
            return cfg;
        }
        try {
            parsed = JSON.parse(metricConfigJson);
            cfg.salesOrderAmountField = normalizeAmountField(toText(parsed.salesOrderAmountField) || cfg.salesOrderAmountField);
            cfg.invoiceAmountField = normalizeAmountField(toText(parsed.invoiceAmountField) || cfg.invoiceAmountField);
            cfg.grossProfitSource = normalizeGrossProfitSource(toText(parsed.grossProfitSource) || cfg.grossProfitSource);
            cfg.collectionMode = 'customer_payment_over_invoice';
            cfg.quoteToSoMode = 'createdfrom_approx';
            cfg.docRequiredFields = normalizeDocRequiredFields(toText(parsed.docRequiredFields) || cfg.docRequiredFields);
            cfg.onlyGenerateWhenActive = isChecked(parsed.onlyGenerateWhenActive) || parsed.onlyGenerateWhenActive === true;
        } catch (e) {
            log.debug('指标规则JSON解析失败', getErrorMessage(e));
        }
        return cfg;
    }

    function stringifyMetricConfig(metricConfig) {
        var cfg = metricConfig || defaultMetricConfig();
        return JSON.stringify({
            salesOrderAmountField: normalizeAmountField(toText(cfg.salesOrderAmountField)),
            invoiceAmountField: normalizeAmountField(toText(cfg.invoiceAmountField)),
            grossProfitSource: normalizeGrossProfitSource(toText(cfg.grossProfitSource)),
            collectionMode: 'customer_payment_over_invoice',
            quoteToSoMode: 'createdfrom_approx',
            docRequiredFields: normalizeDocRequiredFields(toText(cfg.docRequiredFields)),
            onlyGenerateWhenActive: isChecked(cfg.onlyGenerateWhenActive) || cfg.onlyGenerateWhenActive === true
        });
    }

    function isChecked(value) {
        var text = toText(value).toUpperCase();
        return text === 'T' || text === 'TRUE' || text === '1' || value === true;
    }

    function normalizeAmountField(value) {
        return value === 'total' ? 'total' : 'amount';
    }

    function normalizeGrossProfitSource(value) {
        return value === 'always_zero' ? 'always_zero' : 'grossprofit_or_zero';
    }

    function normalizeDocRequiredFields(value) {
        var text = toText(value).toLowerCase().replace(/\s+/g, '');
        return text || 'entity,salesrep,trandate,item,amount';
    }

    function getErrorMessage(errorObj) {
        if (!errorObj) {
            return '';
        }
        if (errorObj.stack) {
            return toText(errorObj.name) + ': ' + toText(errorObj.message) + ', stack: ' + toText(errorObj.stack);
        }
        return toText(errorObj.name) + ': ' + toText(errorObj.message);
    }


    return {
        onRequest: onRequest
    };
});
