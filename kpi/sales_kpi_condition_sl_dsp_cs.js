/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define([], function () {
    function fieldChanged(context) {
        var fieldId = context.fieldId;
        var configId = '';
        var urlObj = null;

        if (fieldId !== 'custpage_cfg_source') {
            return;
        }

        configId = String(context.currentRecord.getValue({ fieldId: 'custpage_cfg_source' }) || '').trim();
        if (!configId) {
            return;
        }

        try {
            urlObj = new URL(window.location.href);
            urlObj.searchParams.set('configid', configId);
            urlObj.searchParams.delete('result');
            urlObj.searchParams.delete('taskid');
            window.location.replace(urlObj.toString());
        } catch (e) {
            window.location.reload();
        }
    }

    return {
        fieldChanged: fieldChanged
    };
});
