/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/task', 'N/log', 'N/runtime', 'N/ui/serverWidget'], function (record, task, log, runtime, serverWidget) {
    var CONFIG_FIELDS = {
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

    var KPI_TARGET = {
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
        contractUpdateField: 'custscript_skm_contract_update_field',
        onlyGenerateWhenActive: 'custscript_skm_only_generate_when_active'
    };

    function beforeLoad(context) {
        var form = context.form;
        var editableFieldMap = {};
        var fieldIds = [];
        var configKeys = [];
        var i = 0;
        var k = '';
        var fieldId = '';
        var fieldObj = null;

        if (!form || context.type !== context.UserEventType.EDIT) {
            return;
        }

        hideNameField(form);

        editableFieldMap[CONFIG_FIELDS.period] = true;
        editableFieldMap[CONFIG_FIELDS.metricOnlyGenerateWhenActive] = true;
        editableFieldMap[CONFIG_FIELDS.submitNow] = true;

        // Ensure the 3 target fields are explicitly editable.
        fieldIds = [CONFIG_FIELDS.period, CONFIG_FIELDS.metricOnlyGenerateWhenActive, CONFIG_FIELDS.submitNow];
        for (i = 0; i < fieldIds.length; i += 1) {
            fieldId = toText(fieldIds[i]);
            try {
                fieldObj = form.getField({ id: fieldId });
                if (fieldObj) {
                    fieldObj.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.NORMAL
                    });
                }
            } catch (e0) {
                log.debug('beforeLoad editable skip', fieldId + ': ' + getErrorMessage(e0));
            }
        }

        // Lock all other config fields by default (avoids遗漏字段).
        configKeys = Object.keys(CONFIG_FIELDS);
        fieldIds = [];
        for (i = 0; i < configKeys.length; i += 1) {
            k = configKeys[i];
            fieldIds.push(CONFIG_FIELDS[k]);
        }

        for (i = 0; i < fieldIds.length; i += 1) {
            fieldId = toText(fieldIds[i]);
            if (!fieldId || editableFieldMap[fieldId]) {
                continue;
            }

            try {
                fieldObj = form.getField({ id: fieldId });
                if (fieldObj) {
                    fieldObj.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.DISABLED
                    });
                }
            } catch (e) {
                log.debug('beforeLoad skip field', fieldId + ': ' + getErrorMessage(e));
            }
        }
    }

    function hideNameField(form) {
        var nameField = null;
        try {
            nameField = form.getField({ id: 'name' });
            if (nameField) {
                nameField.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
            }
        } catch (e) {
            log.debug('hide name field skip', getErrorMessage(e));
        }
    }


    function beforeSubmit(context) {
        var rec = context.newRecord;
        var oldRec = context.oldRecord;
        var editableFieldMap = {};
        var configKeys = [];
        var i = 0;
        var key = '';
        var fieldId = '';

        if (!rec || !oldRec || context.type !== context.UserEventType.EDIT) {
            return;
        }

        editableFieldMap[CONFIG_FIELDS.period] = true;
        editableFieldMap[CONFIG_FIELDS.metricOnlyGenerateWhenActive] = true;
        editableFieldMap[CONFIG_FIELDS.submitNow] = true;

        configKeys = Object.keys(CONFIG_FIELDS);
        for (i = 0; i < configKeys.length; i += 1) {
            key = configKeys[i];
            fieldId = CONFIG_FIELDS[key];
            if (!fieldId || editableFieldMap[fieldId]) {
                continue;
            }
            try {
                rec.setValue({
                    fieldId: fieldId,
                    value: oldRec.getValue({ fieldId: fieldId })
                });
            } catch (e) {
                log.debug('beforeSubmit keep-old skip', fieldId + ': ' + getErrorMessage(e));
            }
        }
    }

    function afterSubmit(context) {
        var rec = context.newRecord;
        var shouldSubmit = false;
        var taskId = '';
        var recId = '';
        var recType = '';
        var metricCfg = null;
        var params = {};
        var message = '';

        if (!rec || (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT)) {
            return;
        }

        // If save was initiated by Suitelet, Suitelet already handles task submission.
        if (runtime.executionContext === runtime.ContextType.SUITELET) {
            return;
        }

        shouldSubmit = rec.getValue({ fieldId: CONFIG_FIELDS.submitNow }) === true;
        if (!shouldSubmit) {
            return;
        }

        recId = rec.id;
        recType = rec.type;
        metricCfg = parseMetricConfig(toText(rec.getValue({ fieldId: CONFIG_FIELDS.metricConfigJson })));

        assignIfPresent(params, KPI_PARAM_IDS.period, normalizePeriodText(toText(rec.getValue({ fieldId: CONFIG_FIELDS.period }))));
        assignIfPresent(params, KPI_PARAM_IDS.invalidKeywords, toText(rec.getValue({ fieldId: CONFIG_FIELDS.invalidKeywords })));
        assignIfPresent(params, KPI_PARAM_IDS.ownerFields, toText(rec.getValue({ fieldId: CONFIG_FIELDS.ownerFields })));
        assignIfPresent(params, KPI_PARAM_IDS.contractRecType, toText(rec.getValue({ fieldId: CONFIG_FIELDS.contractRecType })));
        assignIfPresent(params, KPI_PARAM_IDS.contractOwnerField, toText(rec.getValue({ fieldId: CONFIG_FIELDS.contractOwnerField })));
        assignIfPresent(params, KPI_PARAM_IDS.contractDueField, toText(rec.getValue({ fieldId: CONFIG_FIELDS.contractDueField })));
        assignIfPresent(params, KPI_PARAM_IDS.contractUpdateField, toText(rec.getValue({ fieldId: CONFIG_FIELDS.contractUpdateField })));
        if (metricCfg.onlyGenerateWhenActive === true || rec.getValue({ fieldId: CONFIG_FIELDS.metricOnlyGenerateWhenActive }) === true) {
            params[KPI_PARAM_IDS.onlyGenerateWhenActive] = 'T';
        }

        try {
            taskId = task.create({
                taskType: task.TaskType.SCHEDULED_SCRIPT,
                scriptId: KPI_TARGET.scriptId,
                deploymentId: KPI_TARGET.deploymentId,
                params: params
            }).submit();
        } catch (e) {
            if (isInQueueError(e)) {
                log.audit('KPI任务排队中', getErrorMessage(e));
                return;
            }
            throw e;
        }

        message = '保存后已自动提交KPI统计任务。任务ID: ' + taskId;
        record.submitFields({
            type: recType,
            id: recId,
            values: buildResultValues(taskId, message)
        });

        log.audit('KPI配置保存触发统计', 'recordId=' + recId + ', taskId=' + taskId);
    }

    function buildResultValues(taskId, message) {
        var values = {};
        values[CONFIG_FIELDS.lastTaskId] = taskId;
        values[CONFIG_FIELDS.lastMessage] = message;
        values[CONFIG_FIELDS.submitNow] = false;
        return values;
    }

    function parseMetricConfig(text) {
        if (!text) {
            return {};
        }
        try {
            return JSON.parse(text);
        } catch (e) {
            log.debug('metric json parse failed', getErrorMessage(e));
            return {};
        }
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
        if (toText(value) !== '') {
            container[key] = value;
        }
    }

    function toText(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value);
    }

    function getErrorMessage(errorObj) {
        if (!errorObj) {
            return '';
        }
        return toText(errorObj.message || errorObj);
    }

    function isInQueueError(errorObj) {
        var msg = toText(errorObj && (errorObj.message || errorObj.details || errorObj));
        var code = toText(errorObj && errorObj.name);
        return msg.indexOf('INQUEUE') > -1 || code === 'FAILED_TO_SUBMIT_JOB_REQUEST_1';
    }

    return {
        beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
});
