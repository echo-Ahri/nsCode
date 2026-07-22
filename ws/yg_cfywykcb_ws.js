/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
define(['N/search', 'N/record', 'N/log', 'N/file', 'N/runtime', 'N/task'], (search, record, log, file, runtime, task) => {
	/**
	 * 工作流动作主入口函数
	 * 根据记录类型选择对应处理逻辑
	 */
	const onAction = (context) => {
		try {
			var this_record = context.newRecord
			var dj_id = this_record.id; //当前id
			var giveaccess = this_record.getValue({ fieldId: 'giveaccess' }); //是否有登录ns权限
			log.debug('工作流触发员工ID', dj_id);

			var is_xs = employeeHasRole(dj_id);

			if (dj_id && giveaccess && is_xs) {
				try {
					var yg_id = dj_id;
					//先查看当前用户有没有业务员库存表 customrecord_person_assignment_table
					var filters = [ //当前业务员
						['custrecord_pat_employee', 'ANYOF', yg_id] //当前业务员
						, 'AND', ['isinactive', 'IS', 'F'] //不是非活动
					];
					var search_data = search.create({ type: 'customrecord_person_assignment_table', filters: filters, columns: ['internalid'] });
					var ywy_kcb_id = null;
					search_data.run().each(function (res) {
						ywy_kcb_id = res.getValue('internalid');
						return false; // 只取第一个匹配项 默认应该只有一个单据
					});
					if (isEmpty(ywy_kcb_id)) { //没有业务员库存表去新建
						var res = createYwyKcb(yg_id);
						if (res.code == 1) {
							ywy_kcb_id = res.data;
						} else {
							log.debug('新建业务员库存表失败', '员工:[' + yg_id + ']' + res.message);
							return;
						}
					}

					// 创建Map/Reduce任务
					var mapReduceTask = task.create({
						taskType: task.TaskType.MAP_REDUCE,
						scriptId: 'customscript_yg_update_ywykcb_map_reduce',
						deploymentId: 'customdeploy_yg_update_ywykcb_map_reduce',
						params: {
							custscript_yg_id: yg_id,
							custscript_ywy_kcb_id: ywy_kcb_id
						}
					});
					// 提交任务并获取任务ID
					var taskId = mapReduceTask.submit();
					log.debug('Map/Reduce任务已提交', '任务ID: ' + taskId);
				} catch (e) {
					log.error('保存失败', e);
				}
			}else{
				log.debug('员工:', {'dj_id': dj_id, 'giveaccess': giveaccess, 'is_xs': is_xs});
			}
		} catch (e) {
			log.error('脚本执行出错', '错误信息: ' + e.message + '\n堆栈: ' + e.stack);
		}
	};

	//查询当前员工是否具有 销售业务专员角色
	function employeeHasRole(employeeId) {
		var result = search.create({
			type: search.Type.EMPLOYEE,
			filters: [
				['internalid', 'anyof', employeeId],
				'AND', ['role', 'anyof', 1898] //销售业务专员
			],
			columns: [
				search.createColumn({ name: 'internalid' })
			]
		}).run().getRange({ start: 0, end: 1 });

		return result.length > 0;
	}

	//新建员工业务员库存表
	function createYwyKcb(yg_id) {
		try {
			var new_record = record.create({ type: 'customrecord_person_assignment_table', isDynamic: true });

			new_record.setValue({ fieldId: 'custrecord_pat_xq_name', value: 5 }); //计划需求分配名称 5-个人计划需求 4-临时需求
			new_record.setValue({ fieldId: 'custrecord_pat_employee', value: yg_id }); //业务员
			new_record.setValue({ fieldId: 'custrecord671', value: 65 }); //业务员库存分配关联ID 业务员库存分配工作流审批人员配置
			var new_id = new_record.save(); //新业务员库存表id
			return { code: 1, message: 'ok', data: new_id };
		} catch (e) {
			log.error('createYwyKcb', e);
			return { code: -1, message: '创建业务员库存表失败', data: [] };
		}
	};

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

	return { onAction };
});
