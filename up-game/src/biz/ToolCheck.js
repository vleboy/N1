
const Util = require("../lib/athena").Util
const RegEnum = require("../lib/athena").RegEnum
const Model = require('../lib/Model').Model
const ToolStatusEnum = require('../lib/Consts').ToolStatusEnum
class ToolCheck {
    /**
     * 检查道具数据
     */
    check(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "toolName", type: "S", min: 1, max: 20 },

            { name: "icon", type: "NS", min: 1, max: 256 },
            { name: "desc", type: "NS", min: 1, max: 200 },
            { name: "remark", type: "NS", min: 1, max: 200 }
        ], inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 数据类型处理
        inparam.toolStatus = ToolStatusEnum.Enable
        inparam.icon = inparam.icon || Model.StringValue
        inparam.desc = inparam.desc || Model.StringValue
        inparam.remark = inparam.remark || Model.StringValue
        inparam.toolPrice = inparam.toolPrice || Model.StringValue      //道具单价
        inparam.comeUpRatio = inparam.comeUpRatio || Model.StringValue  //上浮比例
        inparam.lowerRatio = inparam.lowerRatio || Model.StringValue    //下浮比例

        return [checkAttError, errorParams]
    }

    /**
     * 检查状态变更入参
     * @param {*} inparam 
     */
    checkStatus(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "toolName", type: "S", min: 1, max: 20 },
            { name: "toolId", type: "N", min: 100000, max: 999999 },
            { name: "status", type: "N", min: 0, max: 1 }]
            , inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 数据类型处理
        inparam.toolId = inparam.toolId.toString()
        inparam.status = parseInt(inparam.status)

        return [checkAttError, errorParams]
    }

    /**
     * 检查更新
     * @param {*} inparam 
     */
    checkUpdate(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "toolId", type: "N", min: 100000, max: 999999 },
            { name: "toolName", type: "S", min: 1, max: 20 },
            { name: "toolStatus", type: "N", min: 0, max: 1 },

            { name: "icon", type: "NS", min: 1, max: 256 },
            { name: "desc", type: "NS", min: 1, max: 200 },
            { name: "remark", type: "NS", min: 1, max: 200 }
        ], inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 数据类型处理
        inparam.toolId = inparam.toolId.toString()
        inparam.toolStatus = parseInt(inparam.toolStatus)
        inparam.icon = inparam.icon || Model.StringValue
        inparam.desc = inparam.desc || Model.StringValue
        inparam.remark = inparam.remark || Model.StringValue

        return [checkAttError, errorParams]
    }

    /**
     * 检查删除
     * @param {*} inparam 
     */
    checkDelete(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "toolName", type: "S", min: 1, max: 20 },
            { name: "toolId", type: "N", min: 100000, max: 999999 }]
            , inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 数据类型处理
        inparam.toolId = inparam.toolId.toString()

        return [checkAttError, errorParams]
    }
    /**
    * 检查定价参数
    * @param {*} inparam 
    */
    checkPrice(inparam) {
        let checkArr = [
            { name: "toolName", type: "S", min: 1, max: 20 },
            { name: "status", type: "N", min: 1, max: 2 },
            { name: "toolId", type: "N", min: 100000, max: 999999 },
            { name: "toolPrice", type: "REG", min: 0, max: null, equal: RegEnum.FLOAT2 },
            { name: "lowerRatio", type: "REG", min: 0, max: null, equal: RegEnum.FLOAT2 },
        ]
        if (inparam.status == ToolStatusEnum.limit) {
            checkArr.push({ name: "comeUpRatio", type: "REG", min: 0, max: null, equal: RegEnum.FLOAT2 })
        }
        let [checkAttError, errorParams] = Util.checkProperties(checkArr, inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // 数据类型处理
        inparam.toolId = inparam.toolId.toString()
        if (!inparam.comeUpRatio) {
            inparam.comeUpRatio = Model.StringValue
        } else {
            inparam.comeUpRatio = (+inparam.comeUpRatio).toFixed(2)
        }
        inparam.lowerRatio = (+inparam.lowerRatio).toFixed(2)
        return [checkAttError, errorParams]
    }
}

module.exports = ToolCheck