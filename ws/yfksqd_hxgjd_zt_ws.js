/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
define(['N/search', 'N/record', 'N/log', 'N/ui/dialog', 'N/file'], (search, record, log, file) => {
	/**
	 * 工作流动作主入口函数
	 * 根据记录类型选择对应处理逻辑
	 */
	const onAction = (context) => {
		try {
			var recId = context.newRecord.id; //当前预付款申请单id
			log.debug('提交审核触发回写估价单资金预付款状态工作流触发', '主记录ID: ' + recId);

			//加载预付款申请单
			var yfkRecord = record.load({ type: 'customrecord_pay_form', id: recId });
			if (yfkRecord) {
				var gjd_id = yfkRecord.getValue({ fieldId: 'custrecord_create_gjd_id' }); //估价单关联id
				if (!isEmpty(gjd_id)) { //回写状态
					var gjdRecord = record.load({ type: 'estimate', id: gjd_id });

					gjdRecord.setValue({ fieldId: 'custbody_adv_payment_status', value: 2, ignoreFieldChange: true }); //估价单资金预付款状态 -> 审批中 2
					gjdRecord.save();
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
