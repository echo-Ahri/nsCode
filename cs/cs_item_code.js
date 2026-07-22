/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * 创建新服务货品后，自动编码
 */

define(['N/record', 'N/search', 'N/log', 'N/render', 'N/runtime', 'N/email', 'N/file', 'N/encode', 'N/ui/message', 'N/ui/serverWidget'],

    function (record, search, log, render, runtime, email, file, encode, message, serverWidget) {

        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type
         * @param {Form} scriptContext.form - Current form
         * @Since 2015.2
         */
        function beforeLoad(scriptContext) {
            /**
             * copyRecord update key field Value custrecord_wor_status custrecordcustrecord_wor_email_status
             * @type {number}
             */
            var thisRecord = scriptContext.newRecord;

        }

        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function beforeSubmit(scriptContext) {

        }



        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function afterSubmit(scriptContext) {

            var newRecord = scriptContext.newRecord;
            var id = newRecord.id;

            log.debug("id", id);

            var currentRecord = record.load({ type: 'serviceitem', id: id }); //加载服务货品

            var from_point = currentRecord.getText({ fieldId: 'custitem_from_point' });//起运地
            var to_point = currentRecord.getText({ fieldId: 'custitem_to_point' });//目的地
            var from_point_id = currentRecord.getValue({ fieldId: 'custitem_from_point' });//起运地id
            var to_point_id = currentRecord.getValue({ fieldId: 'custitem_to_point' });//目的地id

            var broad_heading = currentRecord.getText({ fieldId: 'custitem_fee_broad_heading' });//费用大类
            var broad_heading_id = currentRecord.getValue({ fieldId: 'custitem_fee_broad_heading' });//费用大类id

            var fee_detail = currentRecord.getText({ fieldId: 'custitem_fee_detail' });//费用明细
            var fee_detail_id = currentRecord.getValue({ fieldId: 'custitem_fee_detail' });//费用明细

            var box_type = currentRecord.getText({ fieldId: 'custitem_box_type' });//箱型
            var box_type_id = currentRecord.getValue({ fieldId: 'custitem_box_type' });//箱型id

            var huopyszd = currentRecord.getValue({ fieldId: 'custitem_huopyszd' });//货品映射字段

            //如果触发的是费用明细且费用类型和费用大类不为空
            if (broad_heading_id) {

                var chanpdl = currentRecord.getValue("custitem_fee_detail");
                var chanpxl = currentRecord.getValue("custitem_fee_broad_heading");

                // chanpdl = [chanpdl];
                // 确保 chanpdl 是数组类型
                // if (chanpdl && !Array.isArray(chanpdl)) {
                //   chanpdl = [chanpdl]; // 如果是单一值，转为数组
                // }

                if (chanpdl) {
                    // 搜索 customrecord_biammgz 记录
                    var biammgzSearch = search.create({
                        type: 'customrecord_biammgz',
                        filters: [
                            ['custrecord_shifouqiyong', 'is', true],
                            'AND',
                            ['custrecord_gzdy_xnfydl', 'anyof', chanpdl],
                            'AND',
                            ['custrecord_gzdy_xnfymx', 'anyof', chanpxl]
                        ],
                        columns: ['custrecord_bianmgz', 'custrecord_zdsx', 'custrecord_gzdy_xnfydl', 'custrecord_gzdy_xnfymx', 'custrecord_gzdyfydlxs', 'custrecord255']
                    });

                    // 获取搜索结果
                    var searchResult = biammgzSearch.run().getRange({
                        start: 0,
                        end: 100
                    });

                    log.debug("搜索结果", "搜索到的记录数量: " + searchResult.length);

                    if (searchResult.length > 0) {
                        var encodingRule = searchResult[0].getValue('custrecord_bianmgz');
                        var encodingRuleIds = searchResult[0].getText('custrecord_bianmgz'); // 获取文本值
                        var zdsx = searchResult[0].getValue('custrecord_zdsx');//获取字段顺序值
                        var cpdl = searchResult[0].getValue('custrecord_guizduiydal');//获取对应产品大类值
                        var cpdlwb = searchResult[0].getText('custrecord_guizduiydal');//获取对应产品大类值
                        var cpxl = searchResult[0].getText('custrecord_dycpxl');//获取对应产品小类值
                        var cpxil = searchResult[0].getText('custrecord_gzdycpxl');//获取对应产品细类值
                        var cpfydl = searchResult[0].getText('custrecord_gzdy_xnfydl');//获取对应费用大类值
                        var cpfydlxs = searchResult[0].getValue('custrecord_gzdyfydlxs');//获取对应费用大类显示值
                        var cpfymx = searchResult[0].getText('custrecord_gzdy_xnfymx');//获取对应费用明细值
                        var cpfymxxs = searchResult[0].getValue('custrecord255');//获取对应费用明细显示值

                        var encodingRuleId = searchResult[0].id;
                        var combinedFieldValue = ""; // 用于合并字段值的变量

                        if (zdsx) {
                            // 将自定义记录字段的值拆分为数组，并确保没有空值
                            var fieldOrder = zdsx.split("-").map(Number).filter(function (id) {
                                return !isNaN(id); // 过滤掉无效的值（如果有的话）
                            });
                            var cfencodingRule = encodingRule.split(","); // 拆分成数组 [2, 1]
                            // 输出重排前的 ID 顺序
                            // log.debug('重排前的 ID 顺序', cfencodingRule); // 期望输出 [2, 1, 3]
                            // 使用 fieldOrder 顺序来重排 encodingRule 中的 ID
                            var reorderedIds = fieldOrder.map(function (index) {
                                return cfencodingRule[index - 1]; // 因为 fieldOrder 中的 ID 是从 1 开始的，所以需要减 1
                            });

                            // 输出重排后的 ID 顺序
                            // log.debug('重排后的 ID 顺序', reorderedIds); // 期望输出 [2, 1, 3]
                        }


                        if (reorderedIds) {
                            // 如果 reorderedIds 非空，则继续拆分并加载记录
                            reorderedIds.forEach(function (id) {
                                var recordObj = record.load({
                                    type: 'customrecord_bmgzsz', // 你的自定义记录类型ID
                                    id: id // 加载每个对应的自定义记录
                                });

                                // 假设你要获取一个字段值
                                var fieldValue = recordObj.getValue({
                                    fieldId: 'custrecordcustrecord_huop_field_id' // 需要的字段ID
                                });

                                // 将字段值添加到合并的字符串中
                                combinedFieldValue += fieldValue ? fieldValue + " " : ""; // 添加空格分隔符，如果有字段值

                                // log.debug('字段 id ' + id, fieldValue);
                            });
                        }

                        log.debug("编码规则信息", JSON.stringify({
                            encodingRule: encodingRule,
                            encodingRuleId: encodingRuleId
                        }));

                        var bianmgz_name = encodingRuleIds + "  " + zdsx + "  " + cpfydlxs + "-----" + cpfymxxs;
                        // 设置编码规则到当前记录
                        currentRecord.setValue({
                            fieldId: 'custitemcustitem_encoding_rule',
                            value: bianmgz_name
                        });

                        // 设置货品映射字段到当前记录
                        currentRecord.setValue({
                            fieldId: 'custitem_huopyszd',
                            value: combinedFieldValue
                        });

                        // 记录编码规则ID
                        // currentRecord.setValue({
                        //   fieldId: 'custitemcustitem_encoding_rule_id', // 假设这是记录ID的字段
                        //   value: encodingRuleId
                        // });

                    } else {
                        log.error({
                            title: '未找到符合条件的编码规则',
                            details: '没有找到启用贸易编码规则的记录。'
                        });

                        // 设置编码规则到当前记录
                        currentRecord.setValue({
                            fieldId: 'custitemcustitem_encoding_rule',
                            value: ''
                        });

                        // 设置货品映射字段到当前记录
                        currentRecord.setValue({
                            fieldId: 'custitem_huopyszd',
                            value: ''
                        });
                    }

                    // 输出当前记录的字段信息，确认设置是否生效
                    log.debug("当前记录设置", JSON.stringify({
                        encodingRule: currentRecord.getValue('custitemcustitem_encoding_rule'),
                        // encodingRuleId: currentRecord.getValue('custitemcustitem_encoding_rule_id')
                    }));
                }

            }

            var itemName = '';
            var itemId;
            var fee_detail_code; //费用明细编码

            from_point_id = String(from_point_id).padStart(3, '0');
            to_point_id = String(to_point_id).padStart(3, '0');
            box_type_id = String(box_type_id).padStart(2, '0');

            if (fee_detail_id) {
                var fee_detail_record = record.load({ type: 'customrecord_fee_detail_class', id: fee_detail_id });//费用明细
                fee_detail_code = fee_detail_record.getValue("custrecord_fee_detail_id");
                var fee_detail_account = fee_detail_record.getValue("custrecord_fee_detail_account");//会计科目
                if (fee_detail_account) {
                    currentRecord.setValue({ fieldId: "expenseaccount", value: fee_detail_account });
                }
            }

            log.debug("from_point_id", from_point_id);
			
            log.debug("itemName", itemName);
			var broad_heading = currentRecord.getText({ fieldId: 'custitem_scy_major_category' });//费用大类
			var broad_heading_id = currentRecord.getValue({ fieldId: 'custitem_scy_major_category' });//费用大类
			
            log.debug("broad_heading", broad_heading);
            if (broad_heading) {
                itemId = broad_heading_id;
                broad_heading = broad_heading.split(' ')[1];
                itemName = broad_heading;
            }
            if (fee_detail) {
                itemId = itemId + fee_detail_code;
                fee_detail = fee_detail.split(' ')[1];
                itemName = itemName + '-' + fee_detail;
            }
			log.debug("itemName", itemName);

            if (huopyszd) {
                var zdarr = huopyszd.split(' ').map(String).filter(function (id) {
                    return !isEmpty(id); // 过滤掉空值
                });
                zdarr.forEach(function (element) {
					var elementValue = currentRecord.getValue({ fieldId: element });
                    log.debug("elementValue", elementValue);
                    itemName = itemName + '-' + elementValue;
                });
            }

            if (from_point) {
                itemId = itemId + from_point_id;
                itemName = itemName + '-' + from_point;
            }
            if (to_point) {
                itemId = itemId + to_point_id;
                itemName = itemName + '-' + to_point;
            }

            if (box_type) {
                itemId = itemId + box_type_id;
                itemName = itemName + '-' + box_type;
            }

            if (itemName) {
                currentRecord.setValue({ fieldId: "displayname", value: itemName });
            }
            if (itemId) {
                currentRecord.setValue({ fieldId: "itemid", value: itemId });
            }


            var feelItemId = currentRecord.save();
            log.debug("feelItemId", feelItemId);
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



        return {
            // beforeLoad: beforeLoad,
            // beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        };

    });