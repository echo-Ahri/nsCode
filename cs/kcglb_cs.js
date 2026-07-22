/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord'], function (currentRecord) {

	function pageInit(context) {
	}

	//筛选字段变更后自动查询
	function fieldChanged(context) {
		if (
			context.fieldId == 'custpage_filter_hp_id' ||
			context.fieldId == 'custpage_filter_zqk_type' ||
			context.fieldId == 'custpage_filter_zxq_min' ||
			context.fieldId == 'custpage_filter_kyl_min' ||
			context.fieldId == 'custpage_filter_zgy_min' ||
			context.fieldId == 'custpage_filter_zxq_max' ||
			context.fieldId == 'custpage_filter_kyl_max' ||
			context.fieldId == 'custpage_filter_zgy_max'
		) {
			//筛选条件变化后回到第一页重新查询
			goPage(0);
		}
	}

	//分页跳转和筛选查询共用方法
	function goPage(page) {
		var rec = currentRecord.get();

		//获取货品筛选值
		var hpValue = rec.getValue({
			fieldId: 'custpage_filter_hp_id'
		});

		//获取总缺口筛选值
		var zqkValue = rec.getValue({
			fieldId: 'custpage_filter_zqk_type'
		});

		//获取需求池-总需求大于筛选值
		var zxqMinValue = rec.getValue({
			fieldId: 'custpage_filter_zxq_min'
		});

		//获取库存池-可用量大于筛选值
		var kylMinValue = rec.getValue({
			fieldId: 'custpage_filter_kyl_min'
		});

		//获取供应池-总供应大于筛选值
		var zgyMinValue = rec.getValue({
			fieldId: 'custpage_filter_zgy_min'
		});

		//获取需求池-总需求小于筛选值
		var zxqMaxValue = rec.getValue({
			fieldId: 'custpage_filter_zxq_max'
		});

		//获取库存池-可用量小于筛选值
		var kylMaxValue = rec.getValue({
			fieldId: 'custpage_filter_kyl_max'
		});

		//获取供应池-总供应小于筛选值
		var zgyMaxValue = rec.getValue({
			fieldId: 'custpage_filter_zgy_max'
		});

		//保留 NetSuite 原始 URL 中的 script、deploy、compid 等必要参数
		var currentUrl = window.location.href;
		var urlObj = new URL(currentUrl);

		//设置页码
		urlObj.searchParams.set('page', page);

		//设置货品筛选参数
		if (hpValue) {
			if (Array.isArray(hpValue)) {
				if (hpValue.length > 0) {
					urlObj.searchParams.set('custpage_filter_hp_id', hpValue.join(','));
				} else {
					urlObj.searchParams.delete('custpage_filter_hp_id');
				}
			} else {
				urlObj.searchParams.set('custpage_filter_hp_id', hpValue);
			}
		} else {
			urlObj.searchParams.delete('custpage_filter_hp_id');
		}

		//设置总缺口筛选参数
		if (zqkValue) {
			urlObj.searchParams.set('custpage_filter_zqk_type', zqkValue);
		} else {
			urlObj.searchParams.delete('custpage_filter_zqk_type');
		}

		//设置需求池-总需求大于筛选参数
		if (zxqMinValue !== '' && zxqMinValue !== null && zxqMinValue !== undefined) {
			urlObj.searchParams.set('custpage_filter_zxq_min', zxqMinValue);
		} else {
			urlObj.searchParams.delete('custpage_filter_zxq_min');
		}

		//设置库存池-可用量大于筛选参数
		if (kylMinValue !== '' && kylMinValue !== null && kylMinValue !== undefined) {
			urlObj.searchParams.set('custpage_filter_kyl_min', kylMinValue);
		} else {
			urlObj.searchParams.delete('custpage_filter_kyl_min');
		}

		//设置供应池-总供应大于筛选参数
		if (zgyMinValue !== '' && zgyMinValue !== null && zgyMinValue !== undefined) {
			urlObj.searchParams.set('custpage_filter_zgy_min', zgyMinValue);
		} else {
			urlObj.searchParams.delete('custpage_filter_zgy_min');
		}

		//设置需求池-总需求小于筛选参数
		if (zxqMaxValue !== '' && zxqMaxValue !== null && zxqMaxValue !== undefined) {
			urlObj.searchParams.set('custpage_filter_zxq_max', zxqMaxValue);
		} else {
			urlObj.searchParams.delete('custpage_filter_zxq_max');
		}

		//设置库存池-可用量小于筛选参数
		if (kylMaxValue !== '' && kylMaxValue !== null && kylMaxValue !== undefined) {
			urlObj.searchParams.set('custpage_filter_kyl_max', kylMaxValue);
		} else {
			urlObj.searchParams.delete('custpage_filter_kyl_max');
		}

		//设置供应池-总供应小于筛选参数
		if (zgyMaxValue !== '' && zgyMaxValue !== null && zgyMaxValue !== undefined) {
			urlObj.searchParams.set('custpage_filter_zgy_max', zgyMaxValue);
		} else {
			urlObj.searchParams.delete('custpage_filter_zgy_max');
		}

		//关闭 NetSuite 页面离开提醒，避免弹出“可能会离开此网站”
		window.onbeforeunload = null;

		if (typeof jQuery !== 'undefined') {
			jQuery(window).off('beforeunload');
		}

		//跳转到新的 URL，触发 Suitelet 重新查询
		window.location.href = urlObj.toString();
	}

	return {
		pageInit: pageInit,
		fieldChanged: fieldChanged,
		goPage: goPage
	};
});
