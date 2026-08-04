/*
 * @Descripttion: 
 * @Author: dsp
 */
/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/search', 'N/record', 'N/log', 'N/ui/dialog', 'N/url'],
    function (runtime, search, record, log, dialog, url) {
        var EXPORT_OBJ = {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            saveRecord: saveRecord,
            sqThEdit: sqThEdit,
        };

        var thisData = {}; //存储当前对象记录的数据

        // 页面初始化时检查是否有提交结果并显示消息
        function pageInit(context) {
            thisData = context.currentRecord;
            console.log('pageInit');
        }

        function fieldChanged(context) {
            console.log('fieldChanged');
            var change_field = context.fieldId; //当前改变的字段
        }

        // 保存记录时的验证逻辑
        function saveRecord(context) {
            console.log('saveRecord');

            var type = thisData.type;
            if (type != 'lead') { //if (type == 'prospect' || type == 'customer') { //lead销售线索 额外校验 
                var is_tj = true;
                var is_tj_str = '';
                var phone = thisData.getValue({ fieldId: 'phone' });
                var isperson = thisData.getValue({ fieldId: 'isperson' });
                var companyname = thisData.getValue({ fieldId: 'companyname' });

                if (isEmpty(companyname)) {
                    is_tj = false;
                    is_tj_str += ' ' + '公司名称必须填写';
                }
                if (isEmpty(phone)) {
                    is_tj = false;
                    is_tj_str += ' ' + '电话必须填写';
                }

                // console.log('isperson', isperson);
                if (isperson == 'F') { //是公司类型 需要校验地址
                    var addressbook_count = thisData.getLineCount({ sublistId: 'addressbook' });
                    if (addressbook_count <= 0) {
                        is_tj = false;
                        is_tj_str += ' ' + '是公司类型 需要填写地址';
                    }

                    var contactroles_count = thisData.getLineCount({ sublistId: 'contactroles' });
                    if (contactroles_count <= 0) {  //公司类型校验子列表 个人类型名称已经是必填
                        is_tj = false;
                        is_tj_str += ' ' + '是公司类型 需要填写联系人';
                    }
                } else {
                    var firstname = thisData.getValue({ fieldId: 'firstname' });
                    if (isEmpty(firstname)) {
                        is_tj = false;
                        is_tj_str += ' ' + '是个人类型 名称必须填写';
                    }
                }

                if (!is_tj) {
                    dialog.alert({ title: '提示', message: is_tj_str});
                    return false;
                } else {
                    return true;
                }
            }
        }

        //申请退回
        function sqThEdit(recId, recType) {
            var host = url.resolveDomain({ hostType: url.HostType.APPLICATION });
            suiteletUrl = 'https://' + host + '/app/site/hosting/scriptlet.nl?script=1383&deploy=1&rec_id=' + recId + '&rec_type=' + recType; //弹框url

            // 计算弹窗位置，使其居中显示
            var width = 500;
            var height = 360;
            var left = (screen.width - width) / 2;
            var top = (screen.height - height) / 2;

            // 打开弹窗
            window.open(suiteletUrl, '_blank', 'width=' + width + ',height=' + height + ',top=' + top + ',left=' + left + ',resizable=yes,scrollbars=yes');
        }

        //判空工具
        function isEmpty(a) {
            if (a === "") return true; //检验空字符串
            if (a === "null") return true; //检验字符串类型的null
            if (a === "undefined") return true; //检验字符串类型的 undefined
            if (!a && a !== 0 && a !== "") return true; //检验 undefined 和 null           
            if (Array.prototype.isPrototypeOf(a) && a.length === 0) return true; //检验空数组
            if (Object.prototype.isPrototypeOf(a) && Object.keys(a).length === 0) return true; //检验空对象
            return false;
        }

        return EXPORT_OBJ;  // 导出函数对象
    });
