const Util = require("../lib/athena").Util
const Model = require('../lib/Model').Model
const PackageStatusEnum = require('../lib/Consts').PackageStatusEnum
class PackageCheck {
    /**
     * 检查数据
     */
    check(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "packageName", type: "S", min: 1, max: 20 },
            { name: "icon", type: "N", min: 1, max: 32 },
            { name: "duration", type: "N", min: 0, max: 99999 },

            { name: "remark", type: "NS", min: 1, max: 200 }
        ], inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        if (!inparam.content || inparam.content.length < 1 || !inparam.content[0].toolId || !inparam.content[0].toolName) {
            throw { "code": -1, "msg": "道具内容数据不合法", "params": ["content"] }
        }
        if (!inparam.content[0].toolNum) {
            throw { "code": -1, "msg": "道具数量不能为空", "params": ["content"] }
        }

        // 数据类型处理
        inparam.packageStatus = PackageStatusEnum.Enable
        inparam.duration = parseInt(inparam.duration)
        inparam.icon = inparam.icon.toString()
        inparam.remark = inparam.remark || Model.StringValue

        return [checkAttError, errorParams]
    }

    /**
     * 检查状态变更入参
     * @param {*} inparam 
     */
    checkStatus(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "packageName", type: "S", min: 1, max: 20 },
            { name: "packageId", type: "N", min: 100000, max: 999999 },
            { name: "status", type: "N", min: 0, max: 1 }]
            , inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 数据类型处理
        inparam.packageId = inparam.packageId.toString()
        inparam.status = parseInt(inparam.status)

        return [checkAttError, errorParams]
    }

    /**
     * 检查更新
     * @param {*} inparam 
     */
    checkUpdate(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "packageName", type: "S", min: 1, max: 20 },
            { name: "packageId", type: "N", min: 100000, max: 999999 },
            { name: "icon", type: "N", min: 1, max: 32 },
            { name: "duration", type: "N", min: 0, max: 99999 },
            { name: "packageStatus", type: "N", min: 0, max: 1 },

            { name: "remark", type: "NS", min: 1, max: 200 }
        ], inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        if (!inparam.content || inparam.content.length < 1 || !inparam.content[0].toolId || !inparam.content[0].toolName) {
            throw { "code": -1, "msg": "道具内容数据不合法", "params": ["content"] }
        }

        // 数据类型处理
        inparam.packageStatus = parseInt(inparam.packageStatus)
        inparam.duration = parseInt(inparam.duration)
        inparam.packageId = inparam.packageId.toString()
        inparam.icon = inparam.icon.toString()
        inparam.remark = inparam.remark || Model.StringValue

        return [checkAttError, errorParams]
    }

    /**
     * 检查删除
     * @param {*} inparam 
     */
    checkDelete(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "packageName", type: "S", min: 1, max: 20 },
            { name: "packageId", type: "N", min: 100000, max: 999999 }]
            , inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 数据类型处理
        inparam.packageId = inparam.packageId.toString()

        return [checkAttError, errorParams]
    }
}

module.exports = PackageCheck