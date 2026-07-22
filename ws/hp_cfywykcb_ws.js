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
			var is_kc_fp = this_record.getValue({ fieldId: 'custitem_is_kc_fp' }); //是否是库存货品
			log.debug('工作流触发货品ID', dj_id);

			if (dj_id && is_kc_fp) {
				try {
					var hp_id = dj_id;

					// 创建Map/Reduce任务
					var mapReduceTask = task.create({
						taskType: task.TaskType.MAP_REDUCE,
						scriptId: 'customscript_hp_update_ywykcb_map_reduce',
						deploymentId: 'customdeploy_hp_update_ywykcb_map_reduce',
						params: {
							custscript_hp_id: hp_id
						}
					});
					// 提交任务并获取任务ID
					var taskId = mapReduceTask.submit();
					log.debug('Map/Reduce任务已提交', '任务ID: ' + taskId);
				} catch (e) {
					log.error('保存失败', e);
				}
			}
		} catch (e) {
			log.error('脚本执行出错', '错误信息: ' + e.message + '\n堆栈: ' + e.stack);
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
