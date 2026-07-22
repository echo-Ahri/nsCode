/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

define(['N/ui/serverWidget', 'N/search', 'N/redirect', 'N/runtime', 'N/ui/message', 'N/record', 'N/url', 'N/log', 'N/file'],
	function (serverWidget, search, redirect, runtime, message, record, url, log, file,) {
		function onRequest(context) {
			if (context.request.method === 'GET') {
				var create_html = createForm(context); //创建表单并传入上下文
				getDataCreate(context, create_html); //获取数据 并填充
				context.response.writePage(create_html); //返回表单页面
			}
		}

		//创建表单画面字段
		function createForm(context) {
			var create_html = serverWidget.createForm({ title: '请选择需要添加的费用行进行勾选' });

			create_html.addField({
				id: 'select_checkbox_all', type: serverWidget.FieldType.CHECKBOX, label: '全选',
			}).updateLayoutType({ layoutType: serverWidget.FieldLayoutType.OUTSIDEABOVE })
				.updateDisplayType({ displayType: serverWidget.FieldDisplayType.NORMAL })
				.setHelpText({ help: '全选或取消全选所有行' });

			create_html.addFieldGroup({ id: 'fieldgroupid', label: '筛选' });

			var fy_item_name = create_html.addField({ id: 'fy_item_name', type: serverWidget.FieldType.TEXT, label: '费用名称', container: 'fieldgroupid' });
			if (context.request.parameters.fy_item_name) { //设置默认值
				// log.debug("筛选参数", JSON.stringify(context.request.parameters));
				fy_item_name.defaultValue = context.request.parameters.fy_item_name;
			}

			var sublist_html = create_html.addSublist({ id: 'custpage_check_fy_list', type: serverWidget.SublistType.LIST, label: '费用列表' });

			sublist_html.addField({ id: 'custpage_id', type: serverWidget.FieldType.TEXT, label: '内部ID' }).updateDisplayType({
				displayType: serverWidget.FieldDisplayType.HIDDEN
			});
			sublist_html.addField({ id: 'custpage_checkbox', type: serverWidget.FieldType.CHECKBOX, label: '选择' });
			sublist_html.addField({ id: 'custpage_fy_name', type: serverWidget.FieldType.TEXT, label: '费用名称' }); //, source: 'subsidiary'
			sublist_html.addField({ id: 'custpage_sum', type: serverWidget.FieldType.INTEGER, label: '数量' });
			sublist_html.addField({ id: 'custpage_price', type: serverWidget.FieldType.FLOAT, label: '价格' }); //子列表 必须额外设置这行才能编辑.updateDisplayType({ displayType: });

			//画面对应的客户端脚本
			var fileObj = file.load({ id: 'SuiteScripts/dsp_scripts/cs/gjd_fy_alert_box_cs.js' }); //NS对应的脚本路径
			create_html.clientScriptFileId = fileObj.id;

			create_html.addButton({ id: 'custpage_back_check_fy_data', label: '回写费用行', functionName: 'backCheckFyData()' });

			return create_html;
		}

		//根据筛选参数获取数据并填充
		function getDataCreate(context, create_html) {
			var fy_item_name = context.request.parameters.fy_item_name; //费用名称筛选
			var z_gs = context.request.parameters.z_gs; //子公司筛选
			var bz = context.request.parameters.bz; //币种筛选

			var hp_filters = [
				['custitem_scy_major_category', 'ANYOF', 30] //产品大类 30 
			];
			var hp_ids = [];
			//添加子公司筛选
			if (z_gs) {
				hp_filters.push('AND');
				hp_filters.push(['subsidiary', 'ANYOF', z_gs]);
			}
			log.debug('hp_filters', hp_filters);
			var hp_search_data = search.create({ type: 'serviceitem', filters: hp_filters, columns: ['internalid', 'displayname'] }); //serviceitem | otherchargeitem 运费成本价格单 不确定用哪个记录类型, 好像两个都有
			hp_search_data.run().each(function (res) {
				hp_ids.push(res.getValue('internalid'));
				return true;
			});

			var fy_data = [];
			var filters = [
				['isinactive', 'IS', 'F'] //非活动
			];

			if (!isEmpty(hp_ids)) {
				filters.push('AND');
				filters.push(['custrecord_exp_cost_item', 'ANYOF', hp_ids]); //当前子公司的货品
			}

			//添加币种筛选
			if (bz) {
				filters.push('AND');
				filters.push(['custrecord_exp_cost_currency', 'ANYOF', bz]);
			}
			//添加费用筛选
			if (fy_item_name) {
				filters.push('AND');
				filters.push(['custrecord_exp_cost_item_name', 'HASKEYWORDS', '%' + fy_item_name + '%']);
			}

			var cb_type = 'customrecord_expense_cost'; //费用成本价格单  

			log.debug('filters', filters);
			var search_data = search.create({ type: cb_type, filters: filters, columns: ['internalid', 'custrecord_exp_cost_item', 'custrecord_exp_cost_item_name', 'custrecord_exp_cost_price'] }); //serviceitem | otherchargeitem 运费成本价格单 不确定用哪个记录类型, 好像两个都有
			search_data.run().each(function (res) {
				fy_data.push({
					custpage_id: res.getValue('custrecord_exp_cost_item'), //获取内部ID
					custpage_fy_name: res.getValue('custrecord_exp_cost_item_name'), //名称
					custpage_sum: 1, //数量
					custpage_price: res.getValue('custrecord_exp_cost_price') //价格
				});
				return true;
			});

			var sublist_html = create_html.getSublist({ id: 'custpage_check_fy_list' });
			for (var i = 0; i < fy_data.length; i++) {
				for (const [key, value] of Object.entries(fy_data[i])) {
					if (!isEmpty(value)) {
						sublist_html.setSublistValue({ id: key, line: i, value: value });//赋值
					}
				}

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

		return { onRequest: onRequest };
	});