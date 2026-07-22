/*
 * @Descripttion: 
 * @Author: dsp
 */
/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/ui/message', 'N/record', 'N/log', 'N/ui/dialog'],
    function (runtime, message, record, log, dialog) {
        var EXPORT_OBJ = {
            pageInit: pageInit,
            fieldChanged: fieldChanged,
            createXjd: createXjd //生成询价单
        };

        var thisData = {}, changeField = {}; //存储当前对象记录的数据

        // 页面初始化时检查是否有提交结果并显示消息
        function pageInit(context) {
            thisData = context.currentRecord;
            console.log('pageInit');
            // isDisabled
            // console.log(thisData.getSublist({sublistId:'recmachcustrecord_pricing_wopmn'}))
            // console.log(thisData.getSublistField({
            //     sublistId: 'recmachcustrecord_pricing_wopmn',
            //     fieldId: 'custrecord_pricing_count',
            //     line: 0
            // }).id);
            // thisData.getSublistField({
            //     sublistId: 'recmachcustrecord_pricing_wopmn',
            //     fieldId: 'custrecord_pricing_count',
            //     line: 0
            // }).isDisabled = true;
            // thisData.getSublistField({
            //     sublistId: 'recmachcustrecord_pricing_wopmn',
            //     fieldId: 'custrecord_pricing_purchase',
            //     line: 0
            // }).isDisplay = false;
        }

        function fieldChanged(context) {
            console.log('fieldChanged');

            var change_field = context.fieldId; //当前改变的字段
            var hp_field_array = [
                'custrecord_is_xj',
                'custrecord_xs_name',
                'custrecord_xs_name_en',
                'custrecord_pricing_item',
                'custrecord_pricing_count',
                'custrecord_pricing_price_clause',
                'custrecord_pricing_purchase',
                'custrecord_pricing_taxcode',
                'custrecord_pricing_taxrate',
                'custrecord_pricing_saleprice_clause',
                'custrecord_pricing_unit',
                'custrecord_pricing_pack',
                'custrecord_pricing_box_number',
                'custrecord_pricing_production_place',
                'custrecord_item_major_category',
                'custrecord_pricing_item_pod',
                'custrecord_pricingline_trade_destination',
                'custrecord_pricing_line_memo',
                'custrecord_old_xj_price'
            ];
            var zf_field_array = [
                'custrecord_is_zfxj',
                'custrecord_misline_item',
                'custrecord_misline_name',
                'custrecord132',
                'custrecord_misline_box_pile',
                'custrecord_misline_price',
                'custrecord_misline_memo',
                'custrecord133',
                'custrecord_old_zfxj_price'
            ];

            if (hp_field_array.indexOf(change_field) !== -1) {
                var value = thisData.getCurrentSublistValue({ //实时获取改变的值
                    sublistId: 'recmachcustrecord_pricing_wopmn',
                    fieldId: change_field
                });
                var line = thisData.getCurrentSublistIndex({sublistId: 'recmachcustrecord_pricing_wopmn'}); //当前操作的行号
                changeField[change_field + '_' + line] = value;
                // console.log(changeField, change_field, value);
            }

            if (zf_field_array.indexOf(change_field) !== -1) {
                var value = thisData.getCurrentSublistValue({ //实时获取改变的值
                    sublistId: 'customrecord_miscellaneous_line',
                    fieldId: change_field
                });
                var line = thisData.getCurrentSublistIndex({sublistId: 'customrecord_miscellaneous_line'}); //当前操作的行号
                changeField[change_field + '_' + line] = value;
            }
        }

        // 保存记录时的验证逻辑
        function saveRecord(context) {
            
        }

        // 生成询价单
        function createXjd(context) {
            console.log('test');
            var hpItemCount = thisData.getLineCount({ sublistId: 'recmachcustrecord_pricing_wopmn' }); // 获取子列表的行数 货品明细行
            var fyItemCount = thisData.getLineCount({ sublistId: 'recmachcustrecord_misline_pricingmain' }); // 获取子列表的行数 运费明细
            var is_create = true;
            for (var i = 0; i < hpItemCount; i++) {
                var this_hp_id = thisData.getSublistValue({
                    sublistId: 'recmachcustrecord_pricing_wopmn',
                    fieldId: 'id', //货品自增长id
                    line: i
                });
                if(isEmpty(this_hp_id)){
                    is_create = false;
                }
            }
            for (var i = 0; i < fyItemCount; i++) {
                var this_zf_id = thisData.getSublistValue({
                    sublistId: 'recmachcustrecord_misline_pricingmain',
                    fieldId: 'id', //杂费自增长id
                    line: i
                });
                if(isEmpty(this_zf_id)){
                    is_create = false;
                }
            }
            if(!is_create){
                dialog.alert({title:'提示', message: '有操作新子行记录, 请先保存后再生成询价单'});
                return;
            }

            var hpFieldMap = {
                custrecord_xs_cn_name: 'custrecord_xs_name',
                custrecord_xs_en_name: 'custrecord_xs_name_en',
                custrecord_hp_info: 'custrecord_pricing_item',
                custrecord_hp_sl: 'custrecord_pricing_count',
                custrecord_cg_price_tj: 'custrecord_pricing_price_clause',
                custrecord_sc_price: 'custrecord_pricing_purchase',
                custrecord_sm: 'custrecord_pricing_taxcode',
                custrecord_slv: 'custrecord_pricing_taxrate',
                custrecord_xs_price_tj: 'custrecord_pricing_saleprice_clause',
                custrecord_dw: 'custrecord_pricing_unit',
                custrecord_bz: 'custrecord_pricing_pack',
                custrecord_box_num: 'custrecord_pricing_box_number',
                custrecord_cd: 'custrecord_pricing_production_place',
                custrecord_cpdl: 'custrecord_item_major_category',
                custrecord_hp_jfd: 'custrecord_pricing_item_pod',
                custrecord_my_mdd: 'custrecord_pricingline_trade_destination',
                custrecord_xjd_remark: 'custrecord_pricing_line_memo',
                custrecord_xj_q_price: 'custrecord_old_xj_price'
                // custrecord_xj_h_price: 'custrecord_new_xj_price'
            }
            var zfFieldMap = {
                custrecord_zf_info: 'custrecord_misline_item',
                custrecord_zf_name: 'custrecord_misline_name',
                custrecord_zf_xm: 'custrecord132',
                custrecord_box_type: 'custrecord_misline_box_pile',
                custrecord_zf_price: 'custrecord_misline_price',
                custrecord_zf_remark: 'custrecord_misline_memo',
                custrecord_zf_bz: 'custrecord133',
                custrecord_xj_q_zf_price: 'custrecord_old_zfxj_price'
                // custrecord_xj_h_zf_price: 'custrecord_new_zfxj_price'
            }

            try {
                var hjd_id = thisData.getValue({ fieldId: 'id' }); //当前核价单id
                var hjdData = record.load({
                    type: 'customrecord_pricingmain', // 核价单记录类型
                    id: hjd_id
                });
                //创建询价单主行信息
                var newXjdRecord = record.create({
                    type: 'customrecord_mul_xjd', // 多行询价单
                    isDynamic: true
                });
                newXjdRecord.setValue({fieldId: 'custrecord_xjd_status', value: 1}); //询价单状态 1待提交 2待处理 3已处理待审批 4已批准
                newXjdRecord.setValue({fieldId: 'custrecord_xjd_user', value: runtime.getCurrentUser().id}); //询价人
                newXjdRecord.setValue({fieldId: 'custrecord_xjd_sp_status', value: ''}); //审批状态

                var item_num = 0; //是否有子行创建

                //创建询价单货品询价行
                for (var i = 0; i < hpItemCount; i++) {
                    var hp_is_xj = thisData.getSublistValue({
                        sublistId: 'recmachcustrecord_pricing_wopmn',
                        fieldId: 'custrecord_is_xj', //是否询价
                        line: i
                    });
                    var key = 'custrecord_is_xj_' + i;
                    if (!isEmpty(changeField[key])) {
                        hp_is_xj = changeField[key];
                    }
                    
                    var hp_xj_res = thisData.getSublistValue({
                        sublistId: 'recmachcustrecord_pricing_wopmn',
                        fieldId: 'custrecord_xj_res',
                        line: i
                    });
                    if(hp_is_xj && (hp_xj_res == '未询价' || isEmpty(hp_xj_res))){ //勾选询价
                        var hp_item_id = 'recmachcustrecord_mul_xjd_id'; //询价单货品行id
                        
                        newXjdRecord.selectNewLine({ sublistId: hp_item_id }); //添加一条询价货品行
                        
                        var this_hp_id = thisData.getSublistValue({
                            sublistId: 'recmachcustrecord_pricing_wopmn',
                            fieldId: 'id', //货品自增长id
                            line: i
                        });
                        // console.log('this_hp_id', this_hp_id);
                        newXjdRecord.setCurrentSublistValue({
                            sublistId: hp_item_id,
                            fieldId: 'custrecord_cj_hp_id', //询价单货品行 创建自子行ID
                            value: this_hp_id
                        });
                        var price = thisData.getSublistValue({
                            sublistId: 'recmachcustrecord_pricing_wopmn',
                            fieldId: 'custrecord_pricing_result', //销售/采购定价
                            line: i
                        });
                        for (var xjd_item_field in hpFieldMap) {
                            var hjd_hp_field = hpFieldMap[xjd_item_field]; //核价单货品行字段

                            var hp_value = thisData.getSublistValue({
                                sublistId: 'recmachcustrecord_pricing_wopmn',
                                fieldId: hjd_hp_field, 
                                line: i
                            });

                            var hp_key = hjd_hp_field + '_' + i;
                            if (!isEmpty(changeField[hp_key])) { //表示改变过值 动态获取
                                hp_value = changeField[hp_key];
                            }

                            newXjdRecord.setCurrentSublistValue({
                                sublistId: hp_item_id,
                                fieldId: xjd_item_field, //询价单询价货品行
                                value: hp_value
                            });
                        }
                        newXjdRecord.setCurrentSublistValue({
                            sublistId: hp_item_id,
                            fieldId: 'custrecord_xj_q_price', //询价单询价货品行 询价前
                            value: price
                        });

                        newXjdRecord.commitLine({ sublistId: hp_item_id }); //提交询价货品行

                        item_num++;

                        //设置当前核价单子行询价状态
                        hjdData.setSublistValue({
                            sublistId: 'recmachcustrecord_pricing_wopmn',
                            fieldId: 'custrecord_xj_res', //询价结果
                            line: i,
                            value: '已询价未更新' //未询价, 已询价未更新, 已更新
                        });
                        hjdData.setSublistValue({
                            sublistId: 'recmachcustrecord_pricing_wopmn',
                            fieldId: 'custrecord_is_xj', //询价结果
                            line: i,
                            value: true //未询价, 已询价未更新, 已更新
                        });
                        hjdData.setSublistValue({
                            sublistId: 'recmachcustrecord_pricing_wopmn',
                            fieldId: 'custrecord_old_xj_price', //询价前
                            line: i,
                            value: price 
                        });
                    }
                }

                //创建询价单杂费询价行
                for (var i = 0; i < fyItemCount; i++) {
                    var zf_is_xj = thisData.getSublistValue({
                        sublistId: 'recmachcustrecord_misline_pricingmain',
                        fieldId: 'custrecord_is_zfxj', //是否询价
                        line: i
                    });
                    var key = 'custrecord_is_zfxj' + i;
                    if (!isEmpty(changeField[key])) {
                        zf_is_xj = changeField[key];
                    }
                    var zf_xj_res = thisData.getSublistValue({
                        sublistId: 'recmachcustrecord_pricing_wopmn',
                        fieldId: 'custrecord_zfxj_res',
                        line: i
                    });
                    if(zf_is_xj && (zf_xj_res == '未询价' || isEmpty(zf_xj_res))){ //勾选询价
                        var fy_item_id = 'recmachcustrecord_mul_xjd_zfid'; //询价单杂费行id
                        
                        newXjdRecord.selectNewLine({ sublistId: fy_item_id }); //添加一条询价杂费行
                        
                        var this_zf_id = thisData.getSublistValue({
                            sublistId: 'recmachcustrecord_misline_pricingmain',
                            fieldId: 'id', //杂费自增长id
                            line: i
                        });
                        newXjdRecord.setCurrentSublistValue({
                            sublistId: fy_item_id,
                            fieldId: 'custrecord_cj_zf_id', //询价单杂费行 创建自子行ID
                            value: this_zf_id
                        });
                        var price = thisData.getSublistValue({
                            sublistId: 'recmachcustrecord_misline_pricingmain',
                            fieldId: 'custrecord_misline_price', //杂费价
                            line: i
                        });
                        for (var xjd_item_field in zfFieldMap) {
                            var hjd_zf_field = zfFieldMap[xjd_item_field]; //核价单杂费行字段

                            var zf_value = thisData.getSublistValue({
                                sublistId: 'recmachcustrecord_misline_pricingmain',
                                fieldId: hjd_zf_field, 
                                line: i
                            });

                            var zf_key = hjd_zf_field + '_' + i;
                            if (!isEmpty(changeField[zf_key])) { //表示改变过值 动态获取
                                zf_value = changeField[zf_key];
                            }

                            newXjdRecord.setCurrentSublistValue({
                                sublistId: fy_item_id,
                                fieldId: xjd_item_field, //询价单询价杂费行
                                value: zf_value
                            });
                        }
                        newXjdRecord.setCurrentSublistValue({
                            sublistId: fy_item_id,
                            fieldId: 'custrecord_xj_q_zf_price', //询价单询价杂费行 询价前
                            value: price
                        });

                        newXjdRecord.commitLine({ sublistId: fy_item_id }); //提交询价杂费行

                        item_num++;

                        //设置当前核价单子行询价状态
                        hjdData.setSublistValue({
                            sublistId: 'recmachcustrecord_misline_pricingmain',
                            fieldId: 'custrecord_zfxj_res', //询价结果
                            line: i,
                            value: '已询价未更新' //未询价, 已询价未更新, 已更新
                        });
                        hjdData.setSublistValue({
                            sublistId: 'recmachcustrecord_misline_pricingmain',
                            fieldId: 'custrecord_is_zfxj', //是否询价
                            line: i,
                            value: true //未询价, 已询价未更新, 已更新
                        });
                        hjdData.setSublistValue({
                            sublistId: 'recmachcustrecord_misline_pricingmain',
                            fieldId: 'custrecord_old_zfxj_price', //询价前
                            line: i,
                            value: price
                        });
                    }
                }

                if(item_num > 0){
                    var newRecordId = newXjdRecord.save(); //新询价单id
                    // console.log('新询价单ID-->', newRecordId);
                    hjdData.save();
        
                    dialog.alert({title:'提示', message: '已成功创建询价单--ID-->' + newRecordId});
                }else{
                    dialog.alert({title:'提示', message: '子行条件不符合创建'});
                }
            } catch (e) {
                log.error('创建询价单失败', '核价单ID: '+ hjd_id +', 错误信息: '+ e.message +'');
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
