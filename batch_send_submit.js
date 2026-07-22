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
			var form = serverWidget.createForm({ title: '批量发送核算单' });

			//(gdd)
			form.addField({
				id: 'select_checkbox_all',
				type: serverWidget.FieldType.CHECKBOX,
				label: '全选',
			}).updateLayoutType({ layoutType: serverWidget.FieldLayoutType.OUTSIDEABOVE })
				.updateDisplayType({ displayType: serverWidget.FieldDisplayType.NORMAL })
				.setHelpText({ help: '全选或取消全选所有行' });

			// form.addButton({ id: 'send', label: '发送', functionName: 'send' });
			var maxNum = form.addField({ id: 'custpage_maxnum', type: serverWidget.FieldType.INTEGER, label: '当日最大可接收数量' });
			maxNum.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.OUTSIDEABOVE }).setHelpText({ help: '设置接收客服当日最大可接收单据量' });
			maxNum.defaultValue = '10';
			form.addFieldGroup({ id: 'fieldgroupid', label: '筛选' });
			//var record_type = form.addField({ id: 'record_type', type: serverWidget.FieldType.SELECT, label: '单据类型', container: 'fieldgroupid' });
			var business_phase = form.addField({ id: 'business_phase', type: serverWidget.FieldType.SELECT, label: '处理阶段', container: 'fieldgroupid', source: 'customlist_business_phase' });
			// 设置默认值
			if (context.request.parameters.business_phase) {
				business_phase.defaultValue = context.request.parameters.business_phase;
			}
			var document_type = form.addField({ id: 'document_type', type: serverWidget.FieldType.SELECT, label: '贸易类型', container: 'fieldgroupid', source: 'customlist_document_type' });
			if (context.request.parameters.document_type) {
				document_type.defaultValue = context.request.parameters.document_type;
			}
			log.debug("筛选参数", JSON.stringify(context.request.parameters));

			var prSublist = form.addSublist({
				id: 'custpage_pr_list',
				type: serverWidget.SublistType.LIST,
				label: '核算单列表',
			});

			prSublist.addField({ id: 'custpage_id', type: serverWidget.FieldType.TEXT, label: '内部ID', displayType: serverWidget.FieldDisplayType.HIDDEN });
			prSublist.addField({ id: 'custpage_checkbox', type: serverWidget.FieldType.CHECKBOX, label: '选择' });
			prSublist.addField({ id: 'custpage_name', type: serverWidget.FieldType.TEXT, label: '核算单编号' });
			prSublist.addField({ id: 'custpage_created', type: serverWidget.FieldType.TEXT, label: '创建日期' });
			prSublist.addField({ id: 'custpage_subsidiary', type: serverWidget.FieldType.SELECT, label: '子公司', source: 'subsidiary' });
			prSublist.addField({ id: 'custpage_customer', type: serverWidget.FieldType.SELECT, label: '客户', source: 'customer' });
			prSublist.addField({ id: 'custpage_saleperson', type: serverWidget.FieldType.SELECT, label: '业务员', source: 'employee', displayType: serverWidget.FieldDisplayType.INLINE });
			prSublist.addField({ id: 'custpage_gys', type: serverWidget.FieldType.TEXT, label: '供应商' });
			prSublist.addField({ id: 'custpage_document_type', type: serverWidget.FieldType.TEXT, label: '贸易类型' });
			prSublist.addField({ id: 'custpage_business_phase', type: serverWidget.FieldType.TEXT, label: '处理阶段' });
			prSublist.addField({ id: 'custpage_next_service', type: serverWidget.FieldType.TEXT, label: '下一贸易流转' });
			// prSublist.addField({ id: 'custpage_issend', type: serverWidget.FieldType.TEXT, label: '是否发送' });
			prSublist.addField({ id: 'custpage_issend', type: serverWidget.FieldType.TEXT, label: '是否发送' });
			prSublist.addField({ id: 'custpage_issend_toperson', type: serverWidget.FieldType.SELECT, label: '发送给', source: 'employee' });
			// prSublist.addField({ id: 'custpage_approver', type: serverWidget.FieldType.SELECT, label: '审批人', source: 'employee' });
			// prSublist.addField({ id: 'custpage_assign_to', type: serverWidget.FieldType.SELECT, label: '分配给', source: 'employee' });
			//prSublist.addField({ id: 'next_service', type: serverWidget.FieldType.TEXT, label: '下一贸易流转' });

			// 新增查看按钮字段
			prSublist.addField({ id: 'view_po', type: serverWidget.FieldType.TEXT, label: '查看' });

			//画面对应的客户端脚本
			var fileObj = file.load({ id: 'SuiteScripts/dsp_scripts/batch_cs_send_submit.js' }); //NS对应的脚本路径
			form.clientScriptFileId = fileObj.id;

			// log.debug("客户端脚本id："+fileObj.id);

			form.addSubmitButton({ label: '批量发送选中的单据' });

			if (context.request.parameters.message) {
				form.addPageInitMessage({
					type: message.Type.CONFIRMATION,
					title: "提交成功",
					message: context.request.parameters.message,
					duration: 1000
				});
			}

			if (context.request.parameters.failurearning) {
				form.addPageInitMessage({
					type: message.Type.ERROR,
					title: "ERROR",
					message: context.request.parameters.failurearning,
					duration: 5000
				});
			}

			return form;
		}

		//(gdd修改)
		function getPricingOrderData(context) {
			var business_phase = context.request.parameters.business_phase;//处理阶段
			var document_type = context.request.parameters.document_type;//贸易类型

			log.debug("处理阶段" + business_phase);
			log.debug("贸易类型" + document_type);

			var pricingOrder = [];

			var pricingOrderSearch = search.load({
				id: 'customsearch_jsd_batch_use_jb'  //结算单数据（批量发送脚本用，勿动）
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

			// 获取当前用户的下属
			var subordinateIds = getSubordinateIds(currentUser);
			subordinateIds.push(currentUser); // 将当前用户 ID 加入筛选列表

			// 添加业务员字段筛选
			pricingOrderSearch.filters.push(
				search.createFilter({
					name: 'custrecord_accounting_salesman', // 替换为实际的业务员字段 ID
					operator: search.Operator.ANYOF,
					values: subordinateIds
				})
			);
			// 运行搜索并处理结果
			pricingOrderSearch.run().each(function (result) {
				pricingOrder.push({
					custpage_id: result.id,  // 获取内部ID
					custpage_name: result.getValue('name'),//核算单编号
					custpage_created: result.getValue('created'),//创建日期
					custpage_subsidiary: result.getValue('custrecord_accounting_company'),//子公司
					custpage_customer: result.getValue('custrecord_accounting_final_customer'),  // 客户
					custpage_saleperson: result.getValue('custrecord_accounting_salesman'),//业务员
					custpage_gys: result.getText('custrecord_accounting_supplier'),//供应商
					// custpage_document_type: result.getValue('custrecord_pricingmain_document_type'),//贸易类型
					custpage_document_type: result.getText('custrecord_accounting_document_type'),//贸易类型
					// custpage_business_phase: result.getValue('custrecord_pricingmain_business_phase'),//处理阶段
					custpage_business_phase: result.getText('custrecord_accounting_business_phase'),//处理阶段
					// custpage_next_service: result.getValue('custrecord_pricingmain_next_service'),//下一贸易流转
					custpage_next_service: result.getText('	custrecord_accounting_next_service'),//下一贸易流转
					custpage_issend: result.getValue('custrecord_accounting_issend'),//是否发送
					// custpage_issend: result.getText('custrecord_pricingmain_issend'),//是否发送
					custpage_issend_toperson: result.getValue('custrecord73'),//发送给
					// custpage_approver: result.getValue('custrecord46'),//审批人
					custpage_assign_to: result.getValue('custrecord75'),//分配给
				});
				return true;
			});

			log.debug('核算单数据', JSON.stringify(pricingOrder));
			return pricingOrder;  // 返回核价单数据
		}

		// 获取下属 ID 的辅助函数
		function getSubordinateIds(userId) {
			var subordinateIds = [];
			var subordinateSearch = search.create({
				type: search.Type.EMPLOYEE,
				filters: [
					['supervisor', search.Operator.ANYOF, userId]
				],
				columns: ['internalid']
			});

			subordinateSearch.run().each(function (result) {
				subordinateIds.push(result.getValue('internalid'));
				return true;
			});

			return subordinateIds;
		}

		// 填充子列表
		function populateSublist(form, poData) {
			var prSublist = form.getSublist({ id: 'custpage_pr_list' });

			for (var i = 0; i < poData.length; i++) {

				log.debug("poData[i]", poData[i]);
				// 构建核算单页面的 URL
				var poUrl = url.resolveRecord({
					recordType: 'customrecord_accounting_purchase',
					recordId: poData[i].custpage_id,
					isEditMode: false  // 设置为 false 以便进入查看模式
				});

				log.debug("poUrl", poUrl);
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

		// 处理表单提交(gdd)
		function handlePost(context) {
			log.debug('所有提交的参数:', context.request.parameters);
			var failurearning = '';
			var message = '提交成功，请等待客服接收。';
			var lineCount = context.request.getLineCount({ group: 'custpage_pr_list' }); // 获取子列表的行数
			var postMaxNum = context.request.parameters['custpage_maxnum_formattedValue']; //填入最大发送数 是custpage_maxnum_formattedValue
			var updatedIds = []; // 存储已更新的记录ID
			var recipients = []; // 存储已勾选的发送客服
			// log.debug("当前的行数："+lineCount);
			log.debug("postMaxNum", postMaxNum);
			for (var i = 0; i < lineCount; i++) {
				// 检查当前行的复选框是否选中
				var isChecked = context.request.getSublistValue({
					group: 'custpage_pr_list',
					name: 'custpage_checkbox',
					line: i
				});
				// log.debug("复选框的值"+isChecked);

				if (isChecked == 'T') {
					// 获取当前行的记录ID
					var recordId = context.request.getSublistValue({
						group: 'custpage_pr_list',
						name: 'custpage_id',
						line: i
					});
					var sendToPerson = context.request.getSublistValue({
						group: 'custpage_pr_list',
						name: 'custpage_issend_toperson',
						line: i
					});
					log.debug("发送给" + sendToPerson);
					var recipientTodayCountList = getPricingCountByRecipient(sendToPerson);
					if (recipientTodayCountList.length > 0) {
						if (recipientTodayCountList[0].pricingCount >= postMaxNum) {

							var sendToPersonName = search.lookupFields({
								type: search.Type.EMPLOYEE,
								id: sendToPerson,
								columns: ['entityid'],
							}).entityid;
							failurearning += '<p>当前选择客服 ' + sendToPersonName + ' 的人数过多，请重新选择</p>';
							continue;
						}
					}
					// 加载记录并更新 "是否发送" 状态
					if (!isEmpty(recordId)) {
						try {
							var pricingRecord = record.load({
								type: 'customrecord_accounting_purchase', //核算单记录类型id
								id: recordId,
								isDynamic: true
							});

							// 更新字段 "custrecord_accounting_issend" (假设这个字段是 '是否发送')
							pricingRecord.setValue({
								fieldId: 'custrecord_accounting_issend',
								value: true // 设置为 true 表示已发送
							});

							pricingRecord.setValue({
								fieldId: 'custrecord73', //发送给
								value: sendToPerson
							});
							// 保存记录
							pricingRecord.save({ ignoreMandatoryFields: true }); //跳过强制字段校验。
							updatedIds.push(recordId); // 将已更新的记录ID加入列表
						} catch (e) {
							log.error('更新失败', `记录ID: ${recordId}, 错误信息: ${e.message}`);
						}
					}
				}
			}

			log.debug('更新记录ID', updatedIds.join(', '));

			// 返回用户操作反馈
			if (updatedIds.length > 0) {
				log.audit('发送成功', `以下记录已发送: ${updatedIds.join(', ')}`);
				// message =  '<p>成功发送以下记录: ' + updatedIds.join(', ') + '</p>';
				context.response.write('<p>成功发送以下记录: ' + updatedIds.join(', ') + '</p>');
			} else {
				log.audit('无记录发送', '没有选中记录进行发送操作');
				// message =  '<p>未选中任何记录，请选择后再提交。</p>';
				context.response.write('<p>未选中任何记录，请选择后再提交。</p>');
			}


			// 获取筛选参数
			var businessPhase = context.request.parameters.business_phase;
			var documentType = context.request.parameters.document_type;

			if (!!failurearning) {
				message = null;
			}
			// 重新加载页面
			redirect.toSuitelet({
				scriptId: runtime.getCurrentScript().id, // 当前脚本的 scriptId
				deploymentId: runtime.getCurrentScript().deploymentId, // 当前脚本的 deploymentId
				// parameters: context.request.parameters, // 保留筛选参数
				parameters: {
					// 传递筛选参数
					business_phase: businessPhase,
					document_type: documentType,
					message: message,
					failurearning: failurearning
				}
			});
		}

		//获取选中的每个发送给的客服今日已接收核价单计数。
		function getPricingCountByRecipient(recipient) {
			var pricingOrder = [];
			var pricingOrderSearch = search.load({
				id: 'customsearch_jsd_js_num'  // 核算单接收（条数）搜索
			});
			// 添加处理阶段筛选
			// if (recipients.length > 0) { //需写在修改单据之前，改为单个判断
			if (recipient) {
				pricingOrderSearch.filters.push(
					search.createFilter({
						name: 'custrecord73', // 替换为搜索中对应的字段 ID '发送给' 字段
						operator: search.Operator.ANYOF,
						values: [recipient]
					})
				);
			}

			var columns = pricingOrderSearch.columns;
			// 运行搜索并处理结果
			pricingOrderSearch.run().each(function (result) {
				pricingOrder.push({
					pricingRecipient: result.getValue(columns[1]),//发送给
					pricingCount: result.getValue(columns[0]),//核价单计数
				});
				return true;
			});

			log.debug('发送客服计数', JSON.stringify(pricingOrder));
			return pricingOrder;  // 返回勾选的发生给的人员计数
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