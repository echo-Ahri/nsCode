/*
 * @Descripttion: 
 * @Author: dsp
 */
/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/ui/message', 'N/record', 'N/log', 'N/ui/dialog', 'N/search'],
    function (runtime, message, record, log, dialog, search) {
        var EXPORT_OBJ = {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            backWrite: backWrite //回写询价单
        };

        var thisData = {}, changeField = {}; //存储当前对象记录的数据

        // 页面初始化时检查是否有提交结果并显示消息
        function pageInit(context) {
            thisData = context.currentRecord;
            console.log('pageInit');
        }

        function fieldChanged(context) {
            console.log('fieldChanged');

            var change_field = context.fieldId; //当前改变的字段
            var hphx_field_array = [
                'custrecord_xj_h_price'
            ];
            var zfhx_field_array = [
                'custrecord_xj_h_zf_price'
            ];

            if (hphx_field_array.indexOf(change_field) !== -1) {
                var value = thisData.getCurrentSublistValue({ //实时获取改变的值
                    sublistId: 'recmachcustrecord_mul_xjd_id',
                    fieldId: change_field
                });
                var line = thisData.getCurrentSublistIndex({ sublistId: 'recmachcustrecord_mul_xjd_id' }); //当前操作的行号
                changeField[change_field + '_' + line] = value;
                // console.log(changeField, change_field, value);
            }

            if (zfhx_field_array.indexOf(change_field) !== -1) {
                var value = thisData.getCurrentSublistValue({ //实时获取改变的值
                    sublistId: 'recmachcustrecord_mul_xjd_zfid',
                    fieldId: change_field
                });
                var line = thisData.getCurrentSublistIndex({ sublistId: 'recmachcustrecord_mul_xjd_zfid' }); //当前操作的行号
                changeField[change_field + '_' + line] = value;
            }
        }

        // 保存记录时的验证逻辑
        function saveRecord(context) {

        }

        // 回写询价单
        function backWrite(context) {
            console.log('backWrite');
            var hp_item_id = 'recmachcustrecord_mul_xjd_id';
            //拿当前询价单审批状态, 通过才让回写
            var xjd_id = thisData.getValue({ fieldId: 'id' }); //当前询价单id
            var xjdData = record.load({
                type: 'customrecord_mul_xjd', // 询价单记录类型
                id: xjd_id
            });

            var sp_status = xjdData.getValue({
                fieldId: 'custrecord_xjd_sp_status' //审批状态
            });
            if (sp_status != 18) { //不等于审批通过
                dialog.alert({ title: '提示', message: '当前询价单还未审批通过, 请审批通过后再回写询价结果' });
                return;
            }

            //拿行数
            var hpItemCount = thisData.getLineCount({ sublistId: hp_item_id }); // 获取子列表的行数 货品明细行

            //判断是否价格填写完成
            var is_back = true;
            for (var i = 0; i < hpItemCount; i++) {
                var this_xj_h_price = thisData.getSublistValue({
                    sublistId: hp_item_id,
                    fieldId: 'custrecord_xj_h_price', //货品询价后价格
                    line: i
                });
                var key = 'custrecord_xj_h_price_' + i;
                if (!isEmpty(changeField[key])) {
                    this_xj_h_price = changeField[key];
                }
                if (isEmpty(this_xj_h_price)) {
                    is_back = false;
                }
            }
            if (!is_back) {
                dialog.alert({ title: '提示', message: '还存在子行记录未更新价格, 请先更新后再点击回写' });
                return;
            }

            try {
                var gjdSearch = search.create({
                    type: 'estimate', // 估价单  
                    filters: [
                        ['custbody_create_xjd_id', 'anyof', xjd_id]
                    ],
                    columns: ['internalid']
                });
                var gjd_id = null;
                gjdSearch.run().each(function (res) {
                    gjd_id = res.getValue('internalid');
                    return false; // 只取第一个匹配项
                });

                if (!isEmpty(gjd_id)) {
                    var gjdData = record.load({
                        type: 'estimate', // 估价单记录类型
                        id: parseInt(gjd_id),
                        // isDynamic: true
                    });
                    console.log('gjdData', gjdData);

                    //循环找出对应id回写
                    for (var i = 0; i < hpItemCount; i++) {
                        var xj_h_price = thisData.getSublistValue({
                            sublistId: hp_item_id,
                            fieldId: 'custrecord_xj_h_price', //询价后价格
                            line: i
                        });
                        var key = 'custrecord_xj_h_price_' + i;
                        if (!isEmpty(changeField[key])) {
                            xj_h_price = changeField[key];
                        }
                        var xjd_item_id = thisData.getSublistValue({
                            sublistId: hp_item_id,
                            fieldId: 'id', //询价单货品行自增长ID
                            line: i
                        });

                        //当前询价单对应的估价单货品行号
                        var this_xjd_gjd_item_line = gjdData.findSublistLineWithValue({
                            sublistId: 'item',
                            fieldId: 'custcol_xjd_create_id',
                            value: xjd_item_id
                        });
                        console.log('this_xjd_gjd_item_line', this_xjd_gjd_item_line);
                        // return
                        // gjdData.selectLine({ //选择当前询价的行号
                        //     sublistId: 'item',
                        //     line: this_xjd_gjd_item_line
                        // });
                        // //更新估价单货品行记录
                        // gjdData.setCurrentSublistValue({
                        //     sublistId: 'item',
                        //     fieldId: 'custcol_xj_h_price',
                        //     value: xj_h_price,
                        //     ignoreFieldChange: true
                        // });
                        // gjdData.setCurrentSublistValue({
                        //     sublistId: 'item',
                        //     fieldId: 'rate', //价格
                        //     value: xj_h_price,
                        //     ignoreFieldChange: true
                        // });
                        // gjdData.setCurrentSublistValue({
                        //     sublistId: 'item',
                        //     fieldId: 'custcol_xj_res', //询价结果
                        //     value: '已更新',
                        //     ignoreFieldChange: true
                        // });

                        //更新估价单货品行记录
                        gjdData.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_xj_h_price',
                            value: xj_h_price,
                            line: this_xjd_gjd_item_line
                        });
                        gjdData.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate', //价格
                            value: xj_h_price,
                            line: this_xjd_gjd_item_line
                        });
                        gjdData.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_xj_res', //询价结果
                            value: '已更新',
                            line: this_xjd_gjd_item_line
                        });

                        //设置当前询价单子行询价结果
                        xjdData.setSublistValue({
                            sublistId: hp_item_id,
                            fieldId: 'custrecord_hx_hp_res', //询价结果
                            line: i,
                            value: '已回写' //未回写, 已回写
                        });
                        xjdData.setSublistValue({
                            sublistId: hp_item_id,
                            fieldId: 'custrecord_xj_h_price', //询价后价格
                            line: i,
                            value: xj_h_price
                        });
                    }

                    xjdData.setValue({
                        fieldId: 'custrecord_xjd_status', //询价单状态
                        value: 4, //已批准
                        ignoreFieldChange: true
                    });
                    gjdData.save();
                    xjdData.save();

                    dialog.alert({ title: '提示', message: '已成功回写询价价格' });
                } else {
                    dialog.alert({ title: '提示', message: '未找到对应估价单关联' });
                }
            } catch (e) {
                console.log(e);
                log.error('回写询价单价格失败', '询价单ID: ' + xjd_id + ', 错误信息: ' + e.message + '');
            }
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
