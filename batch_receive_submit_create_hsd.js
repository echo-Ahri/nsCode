/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

define(['N/ui/serverWidget', 'N/search', 'N/redirect', 'N/runtime', 'N/ui/message', 'N/record', 'N/url', 'N/log', 'N/file'],
    function (serverWidget, search, redirect, runtime, message, record, url, log, file,) {

        function onRequest(context) {
            if (context.request.method === 'GET') {
                var form = createForm(context);  // 创建表单并传入上下文
                var poData = getPricingOrderData(context);  // 获取采购订单数据，改为加载方式
                populateSublist(form, poData);  // 填充子列表
                context.response.writePage(form);  // 返回表单页面
            } else {
                handlePost(context);  // 处理表单提交
            }
        }

        // 创建表单
        function createForm(context) {
            var form = serverWidget.createForm({ title: '批量接收结算单并创建财务核算单' }); //批量发送核算单 执行 -> 财务(创建核算单)

            //(gdd)
            form.addField({
                id: 'select_checkbox_all',
                type: serverWidget.FieldType.CHECKBOX,
                label: '全选',
            }).updateLayoutType({ layoutType: serverWidget.FieldLayoutType.OUTSIDEABOVE })
                .updateDisplayType({ displayType: serverWidget.FieldDisplayType.NORMAL })
                .setHelpText({ help: '全选或取消全选所有行' });

            form.addFieldGroup({ id: 'fieldgroupid', label: '筛选' });
            var business_phase = form.addField({ id: 'business_phase', type: serverWidget.FieldType.SELECT, label: '处理阶段', container: 'fieldgroupid', source: 'customlist_business_phase' });
            business_phase.defaultValue = 3; //默认执行阶段

            business_phase.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.DISABLED
            });

            var document_type = form.addField({ id: 'document_type', type: serverWidget.FieldType.SELECT, label: '贸易类型', container: 'fieldgroupid', source: 'customlist_document_type' });
            if (context.request.parameters.document_type) {
                document_type.defaultValue = context.request.parameters.document_type;
            }

            var prSublist = form.addSublist({
                id: 'custpage_pr_list',
                type: serverWidget.SublistType.LIST,
                label: '结算单列表',
            });

            prSublist.addField({ id: 'custpage_id', type: serverWidget.FieldType.TEXT, label: '内部ID', displayType: serverWidget.FieldDisplayType.HIDDEN });
            prSublist.addField({ id: 'custpage_checkbox', type: serverWidget.FieldType.CHECKBOX, label: '选择' });
            prSublist.addField({ id: 'custpage_name', type: serverWidget.FieldType.TEXT, label: '结算单编号' });
            prSublist.addField({ id: 'custpage_created', type: serverWidget.FieldType.TEXT, label: '创建日期' });
            prSublist.addField({ id: 'custpage_subsidiary', type: serverWidget.FieldType.SELECT, label: '子公司', source: 'subsidiary' });
            prSublist.addField({ id: 'custpage_customer', type: serverWidget.FieldType.SELECT, label: '客户', source: 'customer' });
            prSublist.addField({ id: 'custpage_saleperson', type: serverWidget.FieldType.SELECT, label: '业务员', source: 'employee', displayType: serverWidget.FieldDisplayType.INLINE });
            prSublist.addField({ id: 'custpage_document_type', type: serverWidget.FieldType.TEXT, label: '贸易类型' });
            prSublist.addField({ id: 'custpage_business_phase', type: serverWidget.FieldType.TEXT, label: '处理阶段' });
            prSublist.addField({ id: 'custpage_next_service', type: serverWidget.FieldType.TEXT, label: '下一贸易流转' });
            prSublist.addField({ id: 'custpage_issend', type: serverWidget.FieldType.TEXT, label: '是否发送' });
            prSublist.addField({ id: 'custpage_issend_toperson', type: serverWidget.FieldType.SELECT, label: '发送给', source: 'employee' });

            // 新增查看按钮字段
            prSublist.addField({ id: 'view_po', type: serverWidget.FieldType.TEXT, label: '查看' });

            //画面对应的客户端脚本
            var fileObj = file.load({ id: 'SuiteScripts/dsp_scripts/batch_cs_receive_submit.js' }); //NS对应的脚本路径
            form.clientScriptFileId = fileObj.id;

            form.addSubmitButton({ label: '批量接收并创建选中的单据' });

            if (context.request.parameters.message) {
                form.addPageInitMessage({
                    type: message.Type.CONFIRMATION,
                    title: "操作成功",
                    message: context.request.parameters.message,
                    duration: 500
                });
            }
            return form;
        }

        //(gdd修改)
        function getPricingOrderData(context) {
            var business_phase = 3;//处理阶段 默认为3
            var document_type = context.request.parameters.document_type;//贸易类型

            log.debug("处理阶段" + business_phase);
            log.debug("贸易类型" + document_type);

            var pricingOrder = [];

            var pricingOrderSearch = search.load({
                id: 'customsearch_jsd_batch_use_jb_js_zx'  // 结算单接收数据执行阶段（批量接收脚本用，勿动） --E-00501
            });

            // 添加处理阶段筛选
            if (business_phase) {
                pricingOrderSearch.filters.push(
                    search.createFilter({
                        name: 'custrecord_accounting_business_phase', // 替换为搜索中对应的字段 ID
                        operator: search.Operator.IS,
                        values: business_phase
                    })
                );
            }

            // 添加贸易类型筛选
            if (document_type) {
                pricingOrderSearch.filters.push(
                    search.createFilter({
                        name: 'custrecord_accounting_document_type', // 替换为搜索中对应的字段 ID
                        operator: search.Operator.IS,
                        values: document_type
                    })
                );
            }
            // 获取当前用户 ID
            var currentUser = runtime.getCurrentUser().id;

            // 获取当前用户的下属列表
            var subordinateIds = getSubordinateIds(currentUser);
            subordinateIds.push(currentUser); // 包括当前用户自身

            log.debug('用户及下属列表', subordinateIds);

            // 创建筛选条件：发送给字段是当前用户/下属或为空
            pricingOrderSearch.filters.push(
                search.createFilter({
                    name: 'custrecord73', // 发送给 字段的 ID 比如发送给我 我就能看到
                    operator: search.Operator.ANYOF,
                    values: subordinateIds.concat('@NONE@') // 合并用户、下属和空值
                })
            );

            // 运行搜索并处理结果
            pricingOrderSearch.run().each(function (result) {
                pricingOrder.push({
                    custpage_id: result.id,  // 获取内部ID
                    custpage_name: result.getValue('name'),//财务核算单编号
                    custpage_created: result.getValue('created'),//创建日期
                    custpage_subsidiary: result.getValue('custrecord_accounting_company'),//子公司
                    custpage_customer: result.getValue('custrecord_accounting_final_customer'),  // 客户
                    custpage_saleperson: result.getValue('custrecord_accounting_salesman'),//业务员
                    custpage_document_type: result.getText('custrecord_accounting_document_type'),//贸易类型
                    custpage_business_phase: result.getText('custrecord_accounting_business_phase'),//处理阶段
                    custpage_next_service: result.getText('custrecord_accounting_next_service'),//下一贸易流转
                    custpage_issend: result.getValue('custrecord_accounting_issend'),//是否发送
                    custpage_issend_toperson: result.getValue('custrecord73'),//发送给
                    custpage_approver: result.getValue('custrecord71'),//审批人
                    custpage_assign_to: result.getValue('custrecord75'),//分配给
                });
                return true;
            });

            log.debug('已发送结算单数据', JSON.stringify(pricingOrder));
            return pricingOrder;  // 返回核算接算单数据
        }

        // 获取下属 ID 的辅助函数
        function getSubordinateIds(userId) {
            var subordinateIds = [];
            var subordinateSearch = search.create({
                type: search.Type.EMPLOYEE,
                filters: [
                    ['supervisor', search.Operator.ANYOF, userId] // 筛选直属下属
                ],
                columns: ['internalid'] // 获取员工 ID
            });

            subordinateSearch.run().each(function (result) {
                subordinateIds.push(result.getValue('internalid')); // 获取下属的 ID
                return true;
            });

            return subordinateIds;
        }

        // 填充子列表
        function populateSublist(form, poData) {
            var prSublist = form.getSublist({ id: 'custpage_pr_list' });

            for (var i = 0; i < poData.length; i++) {
                // 构建核算单页面的 URL
                var poUrl = url.resolveRecord({
                    recordType: 'customrecord_accounting_purchase',
                    recordId: poData[i].custpage_id,
                    isEditMode: false  // 设置为 false 以便进入查看模式
                });

                // 在子列表中设置 "查看" 字段为超链接
                prSublist.setSublistValue({
                    id: 'view_po',
                    line: i,
                    value: '<a href="' + poUrl + '" target="_blank">查看</a>'  // 生成可点击的超链接
                });

                for (const [key, value] of Object.entries(poData[i])) {
                    if (!isEmpty(value)) {
                        prSublist.setSublistValue({ id: key, line: i, value: value });//赋值
                    }
                }

            }
        }

        function handlePost(context) {
            var lineCount = context.request.getLineCount({ group: 'custpage_pr_list' }); // 获取子列表的行数
            var createdIds = []; // 存储已创建的核算单记录ID

            for (var i = 0; i < lineCount; i++) {
                // 检查当前行的复选框是否选中
                var isChecked = context.request.getSublistValue({
                    group: 'custpage_pr_list',
                    name: 'custpage_checkbox',
                    line: i
                });

                if (isChecked === 'T') {
                    // 获取当前行的记录ID
                    var recordId = context.request.getSublistValue({
                        group: 'custpage_pr_list',
                        name: 'custpage_id',
                        line: i
                    });

                    if (recordId) {
                        try {
                            // 加载当前选中的记录
                            var sourceRecord = record.load({
                                type: 'customrecord_accounting_purchase', // 核算单记录类型id 执行
                                id: recordId
                            });

                            log.debug("recordId", recordId);

                            // 获取源记录的 `name` 字段值
                            var sourceName = sourceRecord.getValue({
                                fieldId: 'name' // 获取源记录的名称字段
                            });

                            // 创建财务核算单记录  执行结算 -> 财务核算
                            var newAccountingRecord = record.create({
                                type: 'customrecord_accounting_purchase', // 财务核算单
                                isDynamic: true
                            });

                            var fieldMapping = {
                                custrecord_accounting_company: 'custrecord_accounting_company',
                                custrecord_accounting_salesman: 'custrecord_accounting_salesman',
                                custrecord_accounting_final_customer: 'custrecord_accounting_final_customer',
                                custrecord_accounting_document_type: 'custrecord_accounting_document_type',
                                custrecord_accounting_currency: 'custrecord_accounting_currency',
                                custrecord_accounting_allpayment_date: 'custrecord_accounting_allpayment_date',
                                custrecord_accounting_service_route: 'custrecord_accounting_service_route',
                                custrecord_accounting_hl: 'custrecord_accounting_hl',
                                custrecord_accounting_collection_date: 'custrecord_accounting_collection_date',
                                custrecord_accounting_business_phase: 'custrecord_accounting_business_phase', //下面动态更新
                                custrecord_accounting_next_service: 'custrecord_accounting_next_service', //下一贸易流转
                                custrecord_accounting_shipment_date: 'custrecord_accounting_shipment_date',
                                custrecord_accounting_rel_po: 'custrecord_accounting_rel_po',
                                custrecord_accounting_total_freight: 'custrecord_accounting_total_freight',
                                custrecord_accounting_tradetype: 'custrecord_accounting_tradetype', //销售类型
                                custrecord_accounting_payment_method: 'custrecord_accounting_payment_method', //付款方式
                                custrecord_accouting_place_of_delivery: 'custrecord_accouting_place_of_delivery', //货品交付地
                                custrecord_accounting_trade_destination: 'custrecord_accounting_trade_destination' //货品目的地
                            };

                            // 根据字段映射表复制主记录数据
                            for (var sourceField in fieldMapping) {
                                var targetField = fieldMapping[sourceField];
                                var fieldValue = sourceRecord.getValue({ fieldId: sourceField });
                                if (!isEmpty(targetField)) {
                                    // 设置值到目标字段
                                    newAccountingRecord.setValue({
                                        fieldId: targetField,
                                        value: fieldValue
                                    });
                                }
                            }

                            // 子列表映射表
                            var sublistMapping = [
                                {
                                    sourceSublistId: 'recmachcustrecord_freightline_accountmain', // 当前记录子列表ID
                                    targetSublistId: 'recmachcustrecord_freightline_accountmain' // 新记录目标子列表ID
                                },
                                {
                                    sourceSublistId: 'recmachcustrecord_misline_accountmain', // 第二个子列表
                                    targetSublistId: 'recmachcustrecord_misline_accountmain' // 对应目标子列表
                                },
                                {
                                    sourceSublistId: 'recmachcustrecord_pricing_woan', // 第三个子列表
                                    targetSublistId: 'recmachcustrecord_pricing_woan' // 对应目标子列表
                                }
                            ];

                            // 遍历子列表映射
                            sublistMapping.forEach(function (mapping) {
                                var sourceSublistId = mapping.sourceSublistId;
                                var targetSublistId = mapping.targetSublistId;

                                // 获取源记录子列表的行数
                                var sublistLineCount = sourceRecord.getLineCount({ sublistId: sourceSublistId });
                                // log.debug('处理子列表', `子列表ID: ${sourceSublistId}, 行数: ${sublistLineCount}`);

                                for (var line = 0; line < sublistLineCount; line++) {
                                    // 在目标记录的子列表中添加一行
                                    newAccountingRecord.selectNewLine({ sublistId: targetSublistId });

                                    // 获取并设置子列表字段的值
                                    var numFields = sourceRecord.getSublistFields({ sublistId: sourceSublistId });
                                    numFields.forEach(function (fieldId) {
                                        if (fieldId != "custrecord_pricing_pack") {
                                            var fieldValue = sourceRecord.getSublistValue({
                                                sublistId: sourceSublistId,
                                                fieldId: fieldId,
                                                line: line
                                            });

                                            // 将值设置到目标记录的子列表字段
                                            newAccountingRecord.setCurrentSublistValue({
                                                sublistId: targetSublistId,
                                                fieldId: fieldId,
                                                value: fieldValue
                                            });
                                        }
                                    });
                                    // 提交子列表行
                                    newAccountingRecord.commitLine({ sublistId: targetSublistId });
                                }
                            });

                            // 保存新财务核算单记录
                            var newRecordId = newAccountingRecord.save();
                            log.debug("newRecordId", newRecordId);
                            createdIds.push(newRecordId); // 将创建的核算单ID加入列表
                            // 更新核算单的 `name` 字段
                            var updatedAccountingRecord = record.load({
                                type: 'customrecord_accounting_purchase', // 财务核算记录类型
                                id: newRecordId
                            });

                            // 构建核算单页面的 URL
                            var poUrl = url.resolveRecord({
                                recordType: 'customrecord_accounting_purchase',
                                recordId: recordId,
                                isEditMode: false  // 设置为 false 以便进入查看模式
                            });

                            updatedAccountingRecord.setValue({
                                fieldId: 'name', // 核算单的名称字段
                                value: 'ZX-' + sourceName // 更新为源记录的名称值
                            });

                            updatedAccountingRecord.setValue({
                                fieldId: 'custrecord_accounting_create_from', // 核算单 创建自链接 的名称字段
                                value: poUrl // 更新为记录的创建自
                            });

                            // log.debug("当前下一阶段", parseInt(sourceRecord.getValue({ fieldId: 'custrecord_accounting_business_phase' })) + 1);
                            // throw "退出 测试当前阶段";
                            //业务1 协同2 执行3 财务4
                            updatedAccountingRecord.setValue({
                                fieldId: 'custrecord_accounting_business_phase', // 财务核算单 处理阶段 的名称字段
                                value: parseInt(sourceRecord.getValue({ fieldId: 'custrecord_accounting_business_phase' })) + 1 // 更新为下一阶段
                            });
                            updatedAccountingRecord.setValue({
                                fieldId: 'custrecord_accounting_next_service', // 财务核算单 下一贸易流转 的名称字段
                                value: parseInt(sourceRecord.getValue({ fieldId: 'custrecord_accounting_next_service' })) + 1
                            });

                            // 保存更新后的财务核算单
                            updatedAccountingRecord.save();
                            try {
                                // 更新主记录字段
                                sourceRecord.setValue({
                                    fieldId: 'custrecord_accounting_isclosed', //结算单改为已关闭
                                    value: true
                                });

                                // 获取子列表行数
                                var sublistCount = sourceRecord.getLineCount({
                                    sublistId: 'recmachcustrecord_pricing_woan'
                                });

                                // 遍历子列表行
                                for (var line = 0; line < sublistCount; line++) {
                                    // 更新子列表的 `custrecord_pricing_isclosed` 字段
                                    sourceRecord.setSublistValue({
                                        sublistId: 'recmachcustrecord_pricing_woan',
                                        fieldId: 'custrecord_pricing_isclosed',
                                        line: line,
                                        value: true
                                    });

                                    // 获取当前子列表行的数量字段值
                                    var pricingCount = sourceRecord.getSublistValue({
                                        sublistId: 'recmachcustrecord_pricing_woan',
                                        fieldId: 'custrecord_pricing_count',
                                        line: line
                                    });
                                    // 更新子列表的已流转数量字段
                                    if (pricingCount != null && pricingCount !== '') {
                                        sourceRecord.setSublistValue({
                                            sublistId: 'recmachcustrecord_pricing_woan',
                                            fieldId: 'custrecord_pricing_closed_count',
                                            line: line,
                                            value: pricingCount
                                        });
                                    }
                                }

                                // 提交更新后的记录
                                sourceRecord.save();
                            } catch (e) {
                                log.error('更新记录失败', `记录ID: ${sourceRecord.id}, 错误信息: ${e.message}`);
                            }

                        } catch (e) {
                            log.error('创建财务核算单失败', `来源记录ID: ${recordId}, 错误信息: ${e.message}`);
                        }
                    }
                }
            }

            log.debug('创建的财务核算单记录ID', createdIds.join(', '));

            // 返回用户操作反馈
            if (createdIds.length > 0) {
                log.audit('财务核算单创建成功', `以下财务核算单已创建: ${createdIds.join(', ')}`);
                context.response.write('<p>成功创建以下财务核算单: ' + createdIds.join(', ') + '</p>');
            } else {
                log.audit('无财务核算单创建', '没有选中记录进行创建操作');
                context.response.write('<p>未选中任何记录，请选择后再提交。</p>');
            }

            var documentType = context.request.parameters.document_type;

            // 重新加载页面
            redirect.toSuitelet({
                scriptId: runtime.getCurrentScript().id, // 当前脚本的 scriptId
                deploymentId: runtime.getCurrentScript().deploymentId, // 当前脚本的 deploymentId
                parameters: {
                    // 传递筛选参数
                    document_type: documentType,
                    message: '创建成功'
                }
            });
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
            onRequest: onRequest
        };
    });