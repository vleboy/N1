
const Model = require('../lib/UserConsts').Model
const AdStatusEnum = require('../lib/Model').AdStatusEnum
const RegEnum = require("../lib/athena").RegEnum
const Util = require("../lib/athena").Util
class AdCheck {
    /**
     * 检查数据
     */
    check(inparam) {
        let checkArr = [
            { name: "adName", type: "S", min: 1, max: 10 },
            { name: "url", type: "NREG", min: null, max: null, equal: RegEnum.URL },
            { name: "remark", type: "NS", min: 1, max: 200 }
        ]
        if (inparam.model == 'text') {
            delete inparam.img
            checkArr.push({ name: "text", type: "S", min: 1, max: 99999 })
        } else {
            delete inparam.text
            checkArr.push({ name: "img", type: "REG", min: null, max: null, equal: RegEnum.URL })
        }
        let [checkAttError, errorParams] = Util.checkProperties(checkArr, inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // if(!inparam.imgs || inparam.imgs.length < 1 || inparam.imgs.length > 5){
        //     return { "imgs": -1, "msg": "需要图片1-5张", "params": ["imgs"] }
        // }
        if (inparam.publishTime) {
            if (+inparam.publishTime > 2555942400000 || +inparam.publishTime < 1527609600000) {
                throw { "code": -1, "msg": "配置发布时间应在2018-5-30到2050-12-30之间", "params": ["publishTime"] }
            }
        }
        // 数据类型处理
        inparam.type = inparam.type == 'activity' ? inparam.type : 'normal'
        inparam.adStatus = AdStatusEnum.Enable
        inparam.remark = inparam.remark || Model.StringValue
        inparam.url = inparam.url || Model.StringValue
        inparam.publishTime = +inparam.publishTime || Date.now()
    }

    /**
     * 检查状态变更入参
     * @param {*} inparam 
     */
    checkStatus(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "adId", type: "N", min: 100000, max: 999999 },
            { name: "status", type: "N", min: 0, max: 1 }]
            , inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // 数据类型处理
        inparam.adId = inparam.adId.toString()
        inparam.status = parseInt(inparam.status)
    }

    /**
     * 检查更新
     * @param {*} inparam 
     */
    checkUpdate(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "adId", type: "N", min: 100000, max: 999999 },
            { name: "img", type: "NREG", min: null, max: null, equal: RegEnum.URL },
            { name: "url", type: "NREG", min: null, max: null, equal: RegEnum.URL },
            { name: "adName", type: "S", min: 1, max: 20 },
            { name: "adStatus", type: "N", min: 0, max: 1 },
            { name: "remark", type: "NS", min: 1, max: 200 }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // if(!inparam.imgs || inparam.imgs.length < 1 || inparam.imgs.length > 5){
        //     return [{ "imgs": -1, "msg": "需要图片1-5张", "params": ["imgs"] }, 'imgs']
        // }
        // 数据类型处理
        inparam.adId = inparam.adId.toString()
        // inparam.adStatus = parseInt(inparam.adStatus)
        inparam.remark = inparam.remark || Model.StringValue
    }
    /**
     * 检查删除
     * @param {*} inparam 
     */
    checkDelete(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "adId", type: "N", min: 100000, max: 999999 }]
            , inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // 数据类型处理
        inparam.adId = inparam.adId.toString()
    }
    //添加邮件检查
    checkAddEmail(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "title", type: "S", min: 1, max: 20 },
            { name: "content", type: "S", min: 1, max: 200 },
            { name: "tools", type: "J" },
            { name: "sendTime", type: "N" }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
    }
    //添加跑马灯
    checkAddNotic(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "content", type: "S", min: 1, max: 200 },
            { name: "showTime", type: "N" },
            { name: "startTime", type: "N" },
            { name: "endTime", type: "N" },
            { name: "splitTime", type: "N" },
            { name: "count", type: "N" },
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
    }
}

module.exports = AdCheck