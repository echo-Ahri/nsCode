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
			var recId = context.newRecord.id; //当前估价单id
			log.debug('确认库存工作流触发', '主记录ID: ' + recId);

			//加载商机
			var sjRecord = record.load({ type: 'opportunity', id: recId });
			if (sjRecord) {
				//后续是扣减当前业务员库存逻辑
				var sjItemType = 'item';
				var hpItemCount = sjRecord.getLineCount({ sublistId: sjItemType }); // 获取子列表的行数 货品明细行
				var qr_arr = []; //需要确认库存扣减数量的货品
				var qr_kc_none_arr = []; //无业务员库存表id的货品
				for (var i = 0; i < hpItemCount; i++) {
					var hp_type = sjRecord.getSublistValue({ sublistId: sjItemType, fieldId: 'custcol_major_category', line: i });
					if (hp_type != 28) {//产品大类，库存货品=28
						continue;
					}
					//当前货品关联业务员库存分配表id 货品-业务员 唯一
					var ywy_kc_id = sjRecord.getSublistValue({ sublistId: sjItemType, fieldId: 'custcol18', line: i }); //业务员库存分配表

					if (!isEmpty(ywy_kc_id)) {
						//当前货品数量
						var xq_hp_sl = sjRecord.getSublistValue({ sublistId: sjItemType, fieldId: 'quantity', line: i });
						//因为已经校验过 默认是都满足的
						var qr_hp = {}; //确认扣减的货品
						qr_hp.ywy_kc_id = ywy_kc_id;
						qr_hp.xq_hp_sl = xq_hp_sl;
						qr_arr.push(qr_hp);
					} else {
						var kc_none_hp = sjRecord.getSublistValue({ sublistId: sjItemType, fieldId: 'item_display', line: i });
						qr_kc_none_arr.push(kc_none_hp)
					}
				}
				if (qr_kc_none_arr.length > 0) {
					log.debug('错误提示', '主记录ID: ' + recId + ' 当前有货品行未选择业务员库存表, 扣减库存失败');
					return false;
				}
				if (qr_arr.length > 0) {
					for (var i = 0; i < qr_arr.length; i++) {
						var ywy_kc_id = qr_arr[i].ywy_kc_id;
						var xq_hp_sl = qr_arr[i].xq_hp_sl;
						//业务员库存分配行
						var ywy_kc_data = record.load({ type: 'customrecord_person_assignment_line', id: ywy_kc_id });
						var ywy_kc_qrl = ywy_kc_data.getValue({ fieldId: 'custrecord_kc_qr_sl' });  //商机库存确认量
						var ywy_kc_zy = ywy_kc_data.getValue({ fieldId: 'custrecord_pal_yw_dose' }); //业务占用量                            

						ywy_kc_data.setValue({ fieldId: 'custrecord_kc_qr_sl', value: ywy_kc_qrl + xq_hp_sl, ignoreFieldChange: true }); //增加商机库存确认量, 影响业务员计划量, 影响业务员剩余可用量
						ywy_kc_data.setValue({ fieldId: 'custrecord_pal_yw_dose', value: ywy_kc_zy - xq_hp_sl, ignoreFieldChange: true });
						ywy_kc_data.save();
					}
				}

				try {
					sjRecord.setValue({ fieldId: 'custbody_inventory_confirm_status', value: 3 }); //库存确认状态 = 3（已确认）
					sjRecord.setValue({ fieldId: 'custbody49', value: 18 }); //审批状态=18 审批通过
					sjRecord.setValue({ fieldId: 'custbody_txn_approve_status', value: 12 }); //已审批
					//保存记录
					sjRecord.save();
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
