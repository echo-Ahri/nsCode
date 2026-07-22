/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/file', 'N/log', 'N/record', 'N/redirect', 'N/search', 'N/ui/message', 'N/ui/serverWidget', 'N/url', 'N/runtime', 'N/encode', 'N/format'],
	(file, log, record, redirect, search, message, serverWidget, url, runtime, encode, format) => {

		const onRequest = (scriptContext) => {
			//获取当前页面请求参数，包含分页、货品筛选、总缺口筛选、数量大于筛选等
			var parameters = scriptContext.request.parameters;
			log.debug('页面参数', 'parameters: ' + JSON.stringify(parameters));

			//创建页面表单
			var form = createForm(scriptContext);

			//获取库存管理表数据，内部逻辑为：查全量 → 汇总 → 筛选 → 分页
			var pagedDataObj = getKcbData(scriptContext);

			var pageIndex = pagedDataObj.pageIndex; //当前页索引，从0开始
			var totalPages = pagedDataObj.totalPages; //总页数
			var totalCount = pagedDataObj.totalCount; //筛选后的总记录数
			var pageSize = pagedDataObj.pageSize; //页面每页显示数量

			//填充当前页数据到子列表，同时生成跨页递增序号
			populateSublist(form, pagedDataObj.pageDataArr, pageIndex, pageSize);

			//有数据时才显示分页信息和分页按钮
			if (totalPages && totalCount) {
				//为了将分页信息显示在列表右上方，需要增加一个空白区域 筛选信息多个列 需要增加多个列
				form.addField({
					id: 'custpage_blank_info1',
					type: serverWidget.FieldType.INLINEHTML,
					label: ' '
				}).defaultValue = '<div style="margin:2px 8px; text-align:right; width:100%"> </div>';
				form.addField({
					id: 'custpage_blank_info2',
					type: serverWidget.FieldType.INLINEHTML,
					label: ' '
				}).defaultValue = '<div style="margin:2px 8px; text-align:right; width:100%"> </div>';

				//分页信息展示
				form.addField({
					id: 'custpage_pageinfo',
					type: serverWidget.FieldType.INLINEHTML,
					label: ' '
				}).defaultValue =
					'<div style="margin:2px 8px; width:100%; display:flex; justify-content:flex-end;">' +
					'第 <b>' +
					(pageIndex + 1) +
					'</b> / <b>' +
					totalPages +
					'</b> 页，共 <b>' +
					totalCount +
					'</b> 条记录 </div>';

				//上一页、首页按钮
				if (pageIndex > 0) {
					if (pageIndex > 1) {
						form.addButton({
							id: 'custpage_start',
							label: '首页',
							functionName: 'goPage(' + 0 + ')'
						});
					}

					form.addButton({
						id: 'custpage_prev',
						label: '上一页',
						functionName: 'goPage(' + (pageIndex - 1) + ')'
					});
				}

				//下一页、尾页按钮
				if (pageIndex < totalPages - 1) {
					form.addButton({
						id: 'custpage_next',
						label: '下一页',
						functionName: 'goPage(' + (pageIndex + 1) + ')'
					});

					if (pageIndex < totalPages - 2) {
						form.addButton({
							id: 'custpage_end',
							label: '尾页',
							functionName: 'goPage(' + (totalPages - 1) + ')'
						});
					}
				}
			}

			//返回页面
			scriptContext.response.writePage(form);
		};

		//创建页面表单
		function createForm(context) {
			var form = serverWidget.createForm({
				title: '库存管理表'
			});

			//筛选字段组
			const FILTER_ID = 'filter_group_div_id';

			form.addFieldGroup({
				id: FILTER_ID,
				label: '筛选'
			});

			//货品筛选
			var hpField = form.addField({
				id: 'custpage_filter_hp_id',
				type: serverWidget.FieldType.MULTISELECT,
				label: '货品',
				container: FILTER_ID,
				source: 'lotnumberedinventoryitem'
			});

			//总缺口筛选，下拉选择：全部、大于0、小于0
			var zqkFilterField = form.addField({
				id: 'custpage_filter_zqk_type',
				type: serverWidget.FieldType.SELECT,
				label: '总缺口筛选',
				container: FILTER_ID
			});

			zqkFilterField.addSelectOption({
				value: '',
				text: '全部'
			});
			zqkFilterField.addSelectOption({
				value: 'gt0',
				text: '总缺口大于0'
			});
			zqkFilterField.addSelectOption({
				value: 'lt0',
				text: '总缺口小于0'
			});

			//需求池-总需求大于筛选
			var zxqMinField = form.addField({
				id: 'custpage_filter_zxq_min',
				type: serverWidget.FieldType.FLOAT,
				label: '需求池-总需求大于',
				container: FILTER_ID
			});

			//库存池-可用量大于筛选
			var kylMinField = form.addField({
				id: 'custpage_filter_kyl_min',
				type: serverWidget.FieldType.FLOAT,
				label: '库存池-可用量大于',
				container: FILTER_ID
			});

			//供应池-总供应大于筛选
			var zgyMinField = form.addField({
				id: 'custpage_filter_zgy_min',
				type: serverWidget.FieldType.FLOAT,
				label: '供应池-总供应大于',
				container: FILTER_ID
			});

			//需求池-总需求小于筛选
			var zxqMaxField = form.addField({
				id: 'custpage_filter_zxq_max',
				type: serverWidget.FieldType.FLOAT,
				label: '需求池-总需求小于',
				container: FILTER_ID
			});

			//库存池-可用量小于筛选
			var kylMaxField = form.addField({
				id: 'custpage_filter_kyl_max',
				type: serverWidget.FieldType.FLOAT,
				label: '库存池-可用量小于',
				container: FILTER_ID
			});

			//供应池-总供应小于筛选
			var zgyMaxField = form.addField({
				id: 'custpage_filter_zgy_max',
				type: serverWidget.FieldType.FLOAT,
				label: '供应池-总供应小于',
				container: FILTER_ID
			});

			//回显货品筛选条件
			if (context.request.parameters.custpage_filter_hp_id) {
				hpField.defaultValue = context.request.parameters.custpage_filter_hp_id;
			}

			//回显总缺口筛选条件
			if (context.request.parameters.custpage_filter_zqk_type) {
				zqkFilterField.defaultValue = context.request.parameters.custpage_filter_zqk_type;
			}

			//回显需求池-总需求大于筛选条件
			if (context.request.parameters.custpage_filter_zxq_min) {
				zxqMinField.defaultValue = context.request.parameters.custpage_filter_zxq_min;
			}

			//回显库存池-可用量大于筛选条件
			if (context.request.parameters.custpage_filter_kyl_min) {
				kylMinField.defaultValue = context.request.parameters.custpage_filter_kyl_min;
			}

			//回显供应池-总供应大于筛选条件
			if (context.request.parameters.custpage_filter_zgy_min) {
				zgyMinField.defaultValue = context.request.parameters.custpage_filter_zgy_min;
			}

			//回显需求池-总需求小于筛选条件
			if (context.request.parameters.custpage_filter_zxq_max) {
				zxqMaxField.defaultValue = context.request.parameters.custpage_filter_zxq_max;
			}

			//回显库存池-可用量小于筛选条件
			if (context.request.parameters.custpage_filter_kyl_max) {
				kylMaxField.defaultValue = context.request.parameters.custpage_filter_kyl_max;
			}

			//回显供应池-总供应小于筛选条件
			if (context.request.parameters.custpage_filter_zgy_max) {
				zgyMaxField.defaultValue = context.request.parameters.custpage_filter_zgy_max;
			}

			//新增库存管理表虚拟子列表
			var kcbSublist = form.addSublist({
				id: 'custpage_kcb_list',
				type: serverWidget.SublistType.LIST,
				label: '库存管理数据列表'
			});

			//隐藏货品ID，用于后续扩展点击跳转或关联使用
			var kcb_hp_id = kcbSublist.addField({
				id: 'custpage_kcb_line_id',
				type: serverWidget.FieldType.TEXT,
				label: '货品ID'
			});
			kcb_hp_id.updateDisplayType({
				displayType: serverWidget.FieldDisplayType.HIDDEN
			});

			//序号，放在产品编码前面，支持跨页递增
			kcbSublist.addField({
				id: 'custpage_line_no',
				type: serverWidget.FieldType.TEXT,
				label: '序号'
			});

			kcbSublist.addField({
				id: 'custpage_cp_bm',
				type: serverWidget.FieldType.TEXT,
				label: '产品编码'
			});
			kcbSublist.addField({
				id: 'custpage_cp_mc',
				type: serverWidget.FieldType.TEXT,
				label: '产品名称'
			});
			kcbSublist.addField({
				id: 'custpage_cp_bz',
				type: serverWidget.FieldType.TEXT,
				label: '产品包装'
			});

			kcbSublist.addField({
				id: 'custpage_gyc_kcn',
				type: serverWidget.FieldType.TEXT,
				label: '供应池-可承诺'
			});
			kcbSublist.addField({
				id: 'custpage_gyc_ybj',
				type: serverWidget.FieldType.TEXT,
				label: '供应池-已报价'
			});
			kcbSublist.addField({
				id: 'custpage_gyc_yxd',
				type: serverWidget.FieldType.TEXT,
				label: '供应池-已下单'
			});
			kcbSublist.addField({
				id: 'custpage_gyc_zgy',
				type: serverWidget.FieldType.TEXT,
				label: '供应池-总供应'
			});

			kcbSublist.addField({
				id: 'custpage_kcc_dyk_ydg',
				type: serverWidget.FieldType.TEXT,
				label: '库存池-待入库/已订购'
			});
			kcbSublist.addField({
				id: 'custpage_kcc_zkl',
				type: serverWidget.FieldType.TEXT,
				label: '库存池-在库量'
			});
			kcbSublist.addField({
				id: 'custpage_kcc_ycn',
				type: serverWidget.FieldType.TEXT,
				label: '库存池-已承诺'
			});
			kcbSublist.addField({
				id: 'custpage_kcc_kyl',
				type: serverWidget.FieldType.TEXT,
				label: '库存池-可用量'
			});

			kcbSublist.addField({
				id: 'custpage_xqc_ycxq',
				type: serverWidget.FieldType.TEXT,
				label: '需求池-预测需求'
			});
			kcbSublist.addField({
				id: 'custpage_xqc_yxxq',
				type: serverWidget.FieldType.TEXT,
				label: '需求池-意向需求'
			});
			kcbSublist.addField({
				id: 'custpage_xqc_bjxq',
				type: serverWidget.FieldType.TEXT,
				label: '需求池-报价需求'
			});
			kcbSublist.addField({
				id: 'custpage_xqc_ddxq',
				type: serverWidget.FieldType.TEXT,
				label: '需求池-订单需求'
			});
			kcbSublist.addField({
				id: 'custpage_xqc_new_ddxq',
				type: serverWidget.FieldType.TEXT,
				label: '需求池-新增估价单需求'
			});
			kcbSublist.addField({
				id: 'custpage_xqc_zxq',
				type: serverWidget.FieldType.TEXT,
				label: '需求池-总需求'
			});

			kcbSublist.addField({
				id: 'custpage_zqk',
				type: serverWidget.FieldType.TEXT,
				label: '总缺口'
			});

			kcbSublist.addField({
				id: 'custpage_ddqk',
				type: serverWidget.FieldType.TEXT,
				label: '订单缺口'
			});

			//绑定客户端脚本，用于筛选字段自动查询和分页跳转
			var fileObj = file.load({
				id: 'SuiteScripts/dsp_scripts/cs/kcglb_cs.js'
			});
			form.clientScriptFileId = fileObj.id;

			//这里已经去掉查询按钮，筛选字段变更后由客户端脚本自动查询

			//显示失败消息
			if (context.request.parameters.failureMsg) {
				form.addPageInitMessage({
					type: message.Type.ERROR,
					title: 'ERROR',
					message: context.request.parameters.failureMsg
				});
			} else {
				//显示成功消息
				if (context.request.parameters.successMsg) {
					form.addPageInitMessage({
						type: message.Type.CONFIRMATION,
						title: '提交成功',
						message: context.request.parameters.successMsg,
						duration: 1000
					});
				}
			}

			return form;
		}

		//获取库存管理表数据
		function getKcbData(context) {
			var filter_hp_id = context.request.parameters.custpage_filter_hp_id; //货品筛选
			var filter_zqk_type = context.request.parameters.custpage_filter_zqk_type; //总缺口筛选

			var filter_zxq_min = context.request.parameters.custpage_filter_zxq_min; //需求池-总需求大于
			var filter_kyl_min = context.request.parameters.custpage_filter_kyl_min; //库存池-可用量大于
			var filter_zgy_min = context.request.parameters.custpage_filter_zgy_min; //供应池-总供应大于
			var filter_zxq_max = context.request.parameters.custpage_filter_zxq_max; //需求池-总需求小于
			var filter_kyl_max = context.request.parameters.custpage_filter_kyl_max; //库存池-可用量小于
			var filter_zgy_max = context.request.parameters.custpage_filter_zgy_max; //供应池-总供应小于

			log.debug('货品筛选参数', 'filter_hp_id: ' + filter_hp_id);
			log.debug('总缺口筛选参数', 'filter_zqk_type: ' + filter_zqk_type);
			log.debug('需求池总需求筛选参数', 'filter_zxq_min: ' + filter_zxq_min);
			log.debug('库存池可用量筛选参数', 'filter_kyl_min: ' + filter_kyl_min);
			log.debug('供应池总供应筛选参数', 'filter_zgy_min: ' + filter_zgy_min);
			log.debug('需求池总需求小于筛选参数', 'filter_zxq_max: ' + filter_zxq_max);
			log.debug('库存池可用量小于筛选参数', 'filter_kyl_max: ' + filter_kyl_max);
			log.debug('供应池总供应小于筛选参数', 'filter_zgy_max: ' + filter_zgy_max);

			//当前页码，从0开始
			var pageIndex = parseInt(context.request.parameters.page || 0, 10);

			//搜索分页取数数量：NetSuite runPaged 每次最多 1000
			var searchPageSize = 1000;

			//页面分页显示数量：每页显示 15 条
			var displayPageSize = 15;

			//定义返回结果
			var resultData = {
				pageIndex: pageIndex,
				pageSize: displayPageSize,
				totalPages: 0,
				totalCount: 0,
				pageDataArr: []
			};

			//货品基础信息搜索
			var hpListSearch = search.create({
				type: 'lotnumberedinventoryitem',
				id: 'customsearch_hp_search',
				columns: [
					{
						name: 'internalid',
						sortdir: 'ASC'
					},
					{
						name: 'displayname'
					},
					{
						name: 'custitem_product_code'
					},
					{
						name: 'custitem_chinese_package_class'
					}
				]
			});

			//只查参与库存分配的货品
			hpListSearch.filters.push(search.createFilter({
				name: 'custitem_is_kc_fp',
				operator: search.Operator.IS,
				values: ['T']
			}));

			//如果选择了货品，则只查选择的货品
			if (filter_hp_id) {
				var hp_ids = filter_hp_id.split(',');
				hpListSearch.filters.push(search.createFilter({
					name: 'internalid',
					operator: search.Operator.ANYOF,
					values: hp_ids
				}));
			}

			//用 runPaged 获取全量货品，而不是只取当前页
			var hpResults = getAllSearchResults(hpListSearch, searchPageSize);

			if (isEmpty(hpResults)) {
				return resultData;
			}

			var hp_id_arr = [];
			var hpArr = [];

			//整理货品基础信息数组
			hpResults.forEach(function (result) {
				hp_id_arr.push(result.id);

				hpArr.push({
					custpage_kcb_line_id: result.id,
					custpage_cp_mc: result.getValue('displayname'),
					custpage_cp_bm: result.getValue('custitem_product_code'),
					custpage_cp_bz: result.getValue('custitem_chinese_package_class')
				});
			});

			//定义多个 Map，用于按货品ID快速汇总数据，避免多层嵌套循环
			var cgPfdMap = {}; //采购计划批复单汇总 Map
			var kcMap = {}; //库存汇总 Map
			var xqYcMap = {}; //需求预测 Map
			var sjMap = {}; //商机需求汇总 Map
			var gjdMap = {}; //估价单需求汇总 Map

			if (!isEmpty(hp_id_arr)) {
				//采购计划批复单搜索
				var cgjhpfd_search = search.create({
					type: 'customrecord_plan_itemize_line_form',
					filters: [
						['custrecord_plan_il_item', 'ANYOF', hp_id_arr]
					],
					columns: [
						'custrecord_plan_il_item',
						'custrecord_plan_il_approved_quantity',
						'custrecord_plan_il_pos',
						'custrecord_plan_il_unit_price'
					]
				});

				var cg_pfd_results = getAllSearchResults(cgjhpfd_search, searchPageSize);

				//采购计划批复单数据按货品汇总
				cg_pfd_results.forEach(function (res) {
					var hpId = res.getValue('custrecord_plan_il_item');
					var hpPfSl = parseFloat(res.getValue('custrecord_plan_il_approved_quantity') || 0);
					var pfCg = res.getValue('custrecord_plan_il_pos');
					var pfDj = res.getValue('custrecord_plan_il_unit_price');

					if (!cgPfdMap[hpId]) {
						cgPfdMap[hpId] = {
							kcn: 0,
							ybj: 0,
							yxd: 0
						};
					}

					//无批复单价：供应池-可承诺
					if (isEmpty(pfDj)) {
						cgPfdMap[hpId].kcn += hpPfSl;
					} else {
						//有批复单价：供应池-已报价
						cgPfdMap[hpId].ybj += hpPfSl;
					}

					//有关联采购订单号：供应池-已下单
					if (!isEmpty(pfCg)) {
						cgPfdMap[hpId].yxd += hpPfSl;
					}
				});

				//库存数据搜索
				var hp_kc_search = search.create({
					type: search.Type.ITEM,
					filters: [
						['internalid', 'ANYOF', hp_id_arr]
					],
					columns: [
						'internalid',
						'locationquantityonhand',
						'locationquantityavailable',
						'locationquantitycommitted',
						'locationquantityonorder'
					]
				});

				var kc_results = getAllSearchResults(hp_kc_search, searchPageSize);

				//库存数据按货品汇总
				kc_results.forEach(function (res) {
					var hpId = res.getValue('internalid');

					if (!kcMap[hpId]) {
						kcMap[hpId] = {
							drk_kc: 0,
							zk_kc: 0,
							ys_kc: 0,
							kg_kc: 0
						};
					}

					kcMap[hpId].drk_kc += parseFloat(res.getValue('locationquantityonorder') || 0); //待入库/已订购
					kcMap[hpId].zk_kc += parseFloat(res.getValue('locationquantityonhand') || 0); //在库量
					kcMap[hpId].ys_kc += parseFloat(res.getValue('locationquantitycommitted') || 0); //已承诺
					kcMap[hpId].kg_kc += parseFloat(res.getValue('locationquantityavailable') || 0); //可用量
				});

				//先过滤需求预测 主行的 本月内 状态
				var xqyc_arr = [0]; //需求预测 主行id 需要给个默认值
				var xqycThisMonthSearch = search.create({
					type: 'customrecord_need_transfer',
					filters: [
						['custrecord_syn_transfor_status', 'anyof', 18] //审批通过
						, 'AND', ['created', 'within', 'thismonth'] //lastmonth测试
					],
					columns: [
						'internalid'
					]
				});

				xqycThisMonthSearch.run().each(function (result) {
					xqyc_arr.push(result.getValue('internalid'));

					return true;
				});
				log.debug('xqyc_arr', xqyc_arr);

				//需求预测 子行 需求申请需求行搜索
				var xqyc_search = search.create({
					type: 'customrecord_transfer_from_line',
					filters: [
						['custrecord_tfl_item', 'ANYOF', hp_id_arr] //货品id
						, 'AND', ['custrecord_tfl_main', 'ANYOF', xqyc_arr] //过滤对应主行
					],
					columns: [
						'custrecord_tfl_item',
						'custrecord_tfl_need_amount', //需求数量
					]
				});

				var xqyc_results = getAllSearchResults(xqyc_search, searchPageSize);

				//需求预测按货品汇总
				xqyc_results.forEach(function (res) {
					var hpId = res.getValue('custrecord_tfl_item');
					var xqYcSl = parseFloat(res.getValue('custrecord_tfl_need_amount') || 0);

					if (!xqYcMap[hpId]) {
						xqYcMap[hpId] = {
							ycxq: 0
						};
					}

					//所有商机行数量累计为意向需求
					xqYcMap[hpId].ycxq += xqYcSl;
				});

				//商机需求搜索
				var sj_search = search.create({
					type: 'transaction',
					filters: [
						['item.internalid', 'ANYOF', hp_id_arr],
						'AND',
						['type', 'anyof', 'Opprtnty'],
						'AND',
						['mainline', 'is', 'F']
					],
					columns: [
						'custbody_txn_approve_status',
						'internalid',
						'item',
						'quantity'
					]
				});

				var sj_results = getAllSearchResults(sj_search, searchPageSize);

				//商机需求按货品汇总
				sj_results.forEach(function (res) {
					var hpId = res.getValue('item');
					var sjStatus = res.getValue('custbody_txn_approve_status') || 0;
					var sjHpSl = parseFloat(res.getValue('quantity') || 0);

					if (!sjMap[hpId]) {
						sjMap[hpId] = {
							yxxq: 0,
							bjxq: 0
						};
					}

					//审批状态为待审批或空：报价需求
					if (sjStatus == 1 || sjStatus == 0) {
						sjMap[hpId].bjxq += sjHpSl;
					}

					//所有商机行数量累计为意向需求
					sjMap[hpId].yxxq += sjHpSl;
				});

				//估价单需求搜索
				var gjd_search = search.create({
					type: 'transaction',
					filters: [
						['item.internalid', 'ANYOF', hp_id_arr],
						'AND',
						['type', 'ANYOF', 'Estimate'],
						'AND',
						['mainline', 'IS', 'F']
					],
					columns: [
						'internalid',
						'item',
						'opportunity',
						'quantity'
					]
				});

				var gjd_results = getAllSearchResults(gjd_search, searchPageSize);

				//估价单需求按货品汇总
				gjd_results.forEach(function (res) {
					var hpId = res.getValue('item');
					var hpSl = parseFloat(res.getValue('quantity') || 0);

					if (!gjdMap[hpId]) {
						gjdMap[hpId] = {
							ddxq: 0,
							new_ddxq: 0
						};
					}

					var sj_id = res.getValue('opportunity'); //商机id
					if (!isEmpty(sj_id)) { //存在商机id 代表是商机创建的估价单
						gjdMap[hpId].ddxq += hpSl;
					} else { //没有商机id 代表是直接新建的估价单
						gjdMap[hpId].new_ddxq += hpSl;
					}
				});
			}

			//先生成完整汇总结果
			var resultList = buildResultList(hpArr, cgPfdMap, kcMap, sjMap, gjdMap, xqYcMap);
			log.debug('完整结果数量', 'resultList.length: ' + resultList.length);

			//再对完整结果进行筛选
			var filteredList = filterResultList(resultList, {
				filter_zqk_type: filter_zqk_type,
				filter_zxq_min: filter_zxq_min,
				filter_kyl_min: filter_kyl_min,
				filter_zgy_min: filter_zgy_min,
				filter_zxq_max: filter_zxq_max,
				filter_kyl_max: filter_kyl_max,
				filter_zgy_max: filter_zgy_max
			});
			log.debug('筛选后结果数量', 'filteredList.length: ' + filteredList.length);

			//最后对筛选后的结果分页
			var pageData = paginateList(filteredList, pageIndex, displayPageSize);
			log.debug('当前页数据数量', 'pageData.list.length: ' + pageData.list.length);

			resultData.pageIndex = pageData.pageIndex;
			resultData.pageSize = pageData.pageSize;
			resultData.totalPages = pageData.totalPages;
			resultData.totalCount = pageData.totalCount;

			//注意：这里必须是 pageData.list，不能是 resultList / filteredList
			resultData.pageDataArr = pageData.list;

			return resultData;
		}

		//runPaged 查全量搜索结果
		function getAllSearchResults(mySearch, pageSize) {
			var results = [];
			pageSize = pageSize || 1000;

			var pagedData = mySearch.runPaged({
				pageSize: pageSize
			});

			pagedData.pageRanges.forEach(function (pageRange) {
				var page = pagedData.fetch({
					index: pageRange.index
				});

				page.data.forEach(function (result) {
					results.push(result);
				});
			});

			return results;
		}

		//组装完整汇总结果
		function buildResultList(hpArr, cgPfdMap, kcMap, sjMap, gjdMap, xqYcMap) {
			var return_list = [];

			for (var i = 0; i < hpArr.length; i++) {
				var hpId = hpArr[i].custpage_kcb_line_id;

				var cgInfo = cgPfdMap[hpId] || {
					kcn: 0,
					ybj: 0,
					yxd: 0
				};

				var kcInfo = kcMap[hpId] || {
					drk_kc: 0,
					zk_kc: 0,
					ys_kc: 0,
					kg_kc: 0
				};

				var xqYcInfo = xqYcMap[hpId] || {
					ycxq: 0
				};

				var sjInfo = sjMap[hpId] || {
					yxxq: 0,
					bjxq: 0
				};

				var gjdInfo = gjdMap[hpId] || {
					ddxq: 0,
					new_ddxq: 0
				};

				var return_info = {
					custpage_kcb_line_id: hpId,
					custpage_cp_mc: hpArr[i].custpage_cp_mc,
					custpage_cp_bm: hpArr[i].custpage_cp_bm,
					custpage_cp_bz: hpArr[i].custpage_cp_bz,

					custpage_gyc_kcn: cgInfo.kcn,
					custpage_gyc_ybj: cgInfo.ybj,
					custpage_gyc_yxd: cgInfo.yxd,
					custpage_gyc_zgy: 0,

					custpage_kcc_dyk_ydg: kcInfo.drk_kc,
					custpage_kcc_zkl: kcInfo.zk_kc,
					custpage_kcc_ycn: kcInfo.ys_kc,
					custpage_kcc_kyl: kcInfo.kg_kc,

					custpage_xqc_ycxq: xqYcInfo.ycxq, //预测需求

					custpage_xqc_yxxq: sjInfo.yxxq,
					custpage_xqc_bjxq: sjInfo.bjxq,
					custpage_xqc_ddxq: gjdInfo.ddxq,
					custpage_xqc_new_ddxq: gjdInfo.new_ddxq,
					custpage_xqc_zxq: 0,

					custpage_zqk: 0,
					custpage_ddqk: 0,
				};

				//计算供应池-总供应
				var zgy = return_info.custpage_gyc_kcn +
					return_info.custpage_gyc_ybj; //+return_info.custpage_gyc_yxd

				return_info.custpage_gyc_zgy = zgy;

				//计算需求池-总需求
				var zxq = return_info.custpage_xqc_yxxq;// + return_info.custpage_xqc_ddxq(已在商机包含);// + return_info.custpage_xqc_bjxq(不同状态的商机) 
				zxq += return_info.custpage_xqc_new_ddxq; //直接新建的估价单需求
				return_info.custpage_xqc_zxq = zxq;

				//计算总缺口：总需求 - 总供应 - 库存池可用量
				return_info.custpage_zqk = zxq - zgy - return_info.custpage_kcc_kyl;
				//计算订单缺口: 
				return_info.custpage_ddqk = return_info.custpage_xqc_new_ddxq + return_info.custpage_xqc_ddxq - return_info.custpage_kcc_kyl - zgy;

				return_list.push(return_info);
			}

			return return_list;
		}

		//对完整汇总结果进行筛选
		function filterResultList(resultList, params) {
			var filterZqkType = params.filter_zqk_type;

			//三个数量大于筛选条件
			var filterZxqMin = parseFloat(params.filter_zxq_min || '');
			var filterKylMin = parseFloat(params.filter_kyl_min || '');
			var filterZgyMin = parseFloat(params.filter_zgy_min || '');
			var filterZxqMax = parseFloat(params.filter_zxq_max || '');
			var filterKylMax = parseFloat(params.filter_kyl_max || '');
			var filterZgyMax = parseFloat(params.filter_zgy_max || '');

			log.debug('进入总缺口筛选', 'filterZqkType: ' + filterZqkType);
			log.debug('进入需求池总需求筛选', 'filterZxqMin: ' + filterZxqMin);
			log.debug('进入库存池可用量筛选', 'filterKylMin: ' + filterKylMin);
			log.debug('进入供应池总供应筛选', 'filterZgyMin: ' + filterZgyMin);
			log.debug('进入需求池总需求小于筛选', 'filterZxqMax: ' + filterZxqMax);
			log.debug('进入库存池可用量小于筛选', 'filterKylMax: ' + filterKylMax);
			log.debug('进入供应池总供应小于筛选', 'filterZgyMax: ' + filterZgyMax);

			return resultList.filter(function (row) {
				var zqk = parseFloat(row.custpage_zqk || 0); //总缺口
				var zxq = parseFloat(row.custpage_xqc_zxq || 0); //需求池-总需求
				var kyl = parseFloat(row.custpage_kcc_kyl || 0); //库存池-可用量
				var zgy = parseFloat(row.custpage_gyc_zgy || 0); //供应池-总供应

				//总缺口大于0
				if (filterZqkType == 'gt0' && zqk <= 0) {
					return false;
				}

				//总缺口小于0
				if (filterZqkType == 'lt0' && zqk >= 0) {
					return false;
				}

				//需求池-总需求必须大于输入值
				if (!isNaN(filterZxqMin) && zxq <= filterZxqMin) {
					return false;
				}

				//库存池-可用量必须大于输入值
				if (!isNaN(filterKylMin) && kyl <= filterKylMin) {
					return false;
				}

				//供应池-总供应必须大于输入值
				if (!isNaN(filterZgyMin) && zgy <= filterZgyMin) {
					return false;
				}

				//需求池-总需求必须小于输入值
				if (!isNaN(filterZxqMax) && zxq >= filterZxqMax) {
					return false;
				}

				//库存池-可用量必须小于输入值
				if (!isNaN(filterKylMax) && kyl >= filterKylMax) {
					return false;
				}

				//供应池-总供应必须小于输入值
				if (!isNaN(filterZgyMax) && zgy >= filterZgyMax) {
					return false;
				}

				return true;
			});
		}

		//最后对筛选后的结果进行页面分页
		function paginateList(list, pageIndex, pageSize) {
			pageIndex = parseInt(pageIndex || 0, 10);
			pageSize = parseInt(pageSize || 15, 10);

			if (isNaN(pageIndex) || pageIndex < 0) {
				pageIndex = 0;
			}

			if (isNaN(pageSize) || pageSize <= 0) {
				pageSize = 15;
			}

			var totalCount = list.length;
			var totalPages = Math.ceil(totalCount / pageSize);

			if (totalPages === 0) {
				totalPages = 0;
				pageIndex = 0;
			} else if (pageIndex >= totalPages) {
				pageIndex = totalPages - 1;
			}

			var start = pageIndex * pageSize;
			var end = start + pageSize;
			var pageList = list.slice(start, end);

			log.debug('分页信息', 'pageIndex: ' + pageIndex + ', pageSize: ' + pageSize + ', start: ' + start + ', end: ' + end + ', pageList.length: ' + pageList.length);

			return {
				list: pageList,
				pageIndex: pageIndex,
				pageSize: pageSize,
				totalCount: totalCount,
				totalPages: totalPages
			};
		}

		//填充子列表
		function populateSublist(form, kcbData, pageIndex, pageSize) {
			var kcbSublist = form.getSublist({
				id: 'custpage_kcb_list'
			});

			pageIndex = parseInt(pageIndex || 0, 10);
			pageSize = parseInt(pageSize || 15, 10);

			for (var i = 0; i < kcbData.length; i++) {
				//跨页递增序号
				var lineNo = pageIndex * pageSize + i + 1;

				kcbSublist.setSublistValue({
					id: 'custpage_line_no',
					line: i,
					value: String(lineNo)
				});

				//逐字段写入子列表
				for (const [key, value] of Object.entries(kcbData[i])) {
					if (!isEmpty(value)) {
						kcbSublist.setSublistValue({
							id: key,
							line: i,
							value: String(value)
						});
					}
				}
			}
		}

		//判空工具
		function isEmpty(a) {
			if (a === '') return true;
			if (a === 'null') return true;
			if (a === 'undefined') return true;
			if (!a && a !== 0 && a !== '') return true;
			if (Array.prototype.isPrototypeOf(a) && a.length === 0) return true;
			if (Object.prototype.isPrototypeOf(a) && Object.keys(a).length === 0) return true;
			return false;
		}

		return {
			onRequest
		};
	});
