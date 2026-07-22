/*
 * @Descripttion: 
 * @Author: dsp
 */
/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/ui/message', 'N/record', 'N/log', 'N/ui/dialog', 'N/url'],
    function (runtime, message, record, log, dialog, url) {
        var EXPORT_OBJ = {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            jumpSrzd: jumpSrzd,
        };

        var thisData = {}; //存储当前对象记录的数据

        // 页面初始化时检查是否有提交结果并显示消息
        function pageInit(context) {
            thisData = context.currentRecord;
            console.log('pageInit');

            var urls = window.location.href;
            var params = getUrlParams(urls);
            if (!isEmpty(params['xsdd_id'])) { //销售订单跳转
                var xsddData = record.load({ type: 'salesorder', id: params['xsdd_id'] }); //销售订单记录类型

                var custbody_main_currency = xsddData.getValue({ fieldId: 'custbody_main_currency' }); //币种
                var subsidiary = xsddData.getValue({ fieldId: 'subsidiary' }); //子公司
                var entity = xsddData.getValue({ fieldId: 'entity' }); //客户
                var salesrep = xsddData.getValue({ fieldId: 'salesrep' }); //销售代表

                thisData.setValue({ fieldId: 'custrecord_fysqd_sp_id', value: 80, ignoreFieldChange: true });
                thisData.setValue({ fieldId: 'custrecord_fysqd_bz', value: custbody_main_currency, ignoreFieldChange: true });
                thisData.setValue({ fieldId: 'custrecord_fysqd_gs', value: subsidiary, ignoreFieldChange: true });
                thisData.setValue({ fieldId: 'custrecord_fysqd_kh', value: entity, ignoreFieldChange: true });
                thisData.setValue({ fieldId: 'custrecord_fysqd_xsy', value: salesrep, ignoreFieldChange: true });
                thisData.setValue({ fieldId: 'custrecord_fysqd_so_id', value: params['xsdd_id'], ignoreFieldChange: true });
                thisData.setValue({ fieldId: 'custrecord_fysqd_status', value: 1, ignoreFieldChange: true });

                var hp_item_id = 'item'; //销售订单 货品明细行
                var item_id = 'recmachcustrecord_fysqd_id'; //销售费用申请单 货品明细行
                var hpItemCount = xsddData.getLineCount({ sublistId: hp_item_id }); // 获取子列表的行数
                var hpFieldMap = { //销售订单 销售费用申请单 货品字段映射
                    item: 'custrecord_fysqd_i_hp', //货品
                    quantity: 'custrecord_fysqd_i_num', //数量
                    rate: 'custrecord_fysqd_i_price', //价格 - 货品单价
                    taxcode: 'custrecord_fysqd_i_sm', //税码 - 税码
                    inventorylocation: 'custrecord_fysqd_i_kc', //库存地点 - 库存地点
                };

                var price_sum = 0; //计算总金额
                for (var i = 0; i < hpItemCount; i++) {
                    var hp_type = xsddData.getSublistValue({ sublistId: hp_item_id, fieldId: 'custcol_major_category', line: i });
                    if (hp_type != 30) { //产品大类，费用货品=30
                        continue;
                    }

                    thisData.selectNewLine({ sublistId: item_id }); //添加新行

                    for (var xsdd_item_field in hpFieldMap) {
                        var sqd_hp_field = hpFieldMap[xsdd_item_field]; //需求单货品行字段
                        var hp_value = xsddData.getSublistValue({ sublistId: hp_item_id, fieldId: xsdd_item_field, line: i });

                        if (xsdd_item_field == 'rate') { //价格
                            var sl = xsddData.getSublistValue({ sublistId: hp_item_id, fieldId: 'quantity', line: i });
                            price_sum += hp_value * sl; //累加金额
                        }
                        // 将值设置到目标记录的子列表字段
                        thisData.setCurrentSublistValue({ sublistId: item_id, fieldId: sqd_hp_field, value: hp_value }); //, ignoreFieldChange: true
                    }
                    thisData.setCurrentSublistValue({ sublistId: item_id, fieldId: 'custrecord_fysqd_i_fy_type', value: 1 });
                    thisData.setCurrentSublistValue({ sublistId: item_id, fieldId: 'custrecord_xsfysqd_i_gys', value: 12923 });
                    thisData.setCurrentSublistValue({ sublistId: item_id, fieldId: 'custrecord_fysqd_i_yj_je', value: 0 });

                    thisData.commitLine({ sublistId: item_id }); //提交子列表行
                }

                thisData.setValue({ fieldId: 'custrecord_fysqd_so_je', value: price_sum, ignoreFieldChange: true }); //so金额

                dialog.alert({ title: '提示', message: '基础数据已填充, 请修正费用明细行 [费用类型] [供应商] [预计金额] 信息' });
            }
        }

        function fieldChanged(context) {
            console.log('fieldChanged');
            var change_field = context.fieldId; //当前改变的字段
        }

        //跳转输入账单
        function jumpSrzd(recId, recTyp) {
            dialog.confirm({
                title: '提示',
                message: '确认提示, 点击[OK]将跳转至输入账单页面.',
            }).then(function (result) {
                if (result) {
                    var record_data = record.load({ type: recTyp, id: recId }); //当前 销售费用申请单 记录类型
                    var item_id = 'recmachcustrecord_fysqd_id'; //销售费用申请单 货品明细行
                    var hpItemCount = record_data.getLineCount({ sublistId: item_id }); // 获取子列表的行数

                    var host = url.resolveDomain({ hostType: url.HostType.APPLICATION });
                    var gys_id_arr = [];
                    for (var i = 0; i < hpItemCount; i++) {
                        var gys_id = record_data.getSublistValue({ sublistId: item_id, fieldId: 'custrecord_xsfysqd_i_gys', line: i }); //供应商
                        if (!gys_id_arr.includes(gys_id)) {
                            gys_id_arr.push(gys_id);

                            window.open(
                                'https://' + host + '/app/accounting/transactions/vendbill.nl?xsfysqd_id=' + recId + '&gys_id=' + gys_id + '&cf=222&entity=' + gys_id,
                                '_blank'
                            ); //打开多个供应商
                        }
                    }
                }
                return true;
            });
        }

        function getUrlParams(urls) {
            var params = [];
            var urlArr = urls.split('?');
            if (urlArr && urlArr.length > 1) {
                var paramsArr = urlArr[1].split('&');
                for (var i = 0; i < paramsArr.length; i++) {
                    var param = paramsArr[i].split('=');
                    params[param[0]] = param[1];
                }
            }
            return params;
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
