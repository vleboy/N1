const Util = require("../lib/athena").Util
const RegEnum = require("../lib/athena").RegEnum
const Model = require('../lib/Model').Model
const CompanyStatusEnum = require('../lib/Consts').CompanyStatusEnum
class CompanyCheck {
    /**
     * 检查厂商状态变更入参
     * @param {*} inparam 
     */
    checkStatus(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "companyName", type: "REG", min: null, max: null, equal: RegEnum.COMPANYNAME },
            { name: "companyId", type: "S", min: 36, max: 36 },
            { name: "status", type: "N", min: 0, max: 1 }]
            , inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 数据类型处理
        inparam.status = parseInt(inparam.status)

        return [checkAttError, errorParams]
    }

    /**
     * 检查厂商更新数据
     * @param {*} inparam 
     */
    checkUpdate(inparam) {
        let checkArr = [
            { name: "companyId", type: "S", min: 36, max: 36 },
            { name: "companyName", type: "REG", min: null, max: null, equal: RegEnum.COMPANYNAME },
            { name: "companyDesc", type: "NS", min: 2, max: 200 },
            { name: "remark", type: "NS", min: 2, max: 200 }

            // { name: "companyRegion", type: "NS", min: 1, max: 20 },
            // { name: "companyEmail", type: "REG", min: null, max: null, equal: RegEnum.EMAIL },
            // { name: "license", type: "NREG", min: null, max: null, equal: RegEnum.URL },
            // { name: "companyContract", type: "NREG", min: null, max: null, equal: RegEnum.URL },
            // { name: "companyContact", type: "REG", min: null, max: null, equal: RegEnum.COMPANYCONTACT },
            // { name: "companyContactWay", type: "REG", min: null, max: null, equal: RegEnum.COMPANYCONTACTWAY },
        ]
        if (inparam.companyType == 2) {
            checkArr.push({ name: "companyRatio", type: "REG", min: null, max: null, equal: RegEnum.PERCENT })
        }
        let [checkAttError, errorParams] = Util.checkProperties(checkArr, inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 数据类型处理

        inparam.companyStatus = CompanyStatusEnum.Enable
        inparam.companyDesc = inparam.companyDesc || Model.StringValue
        inparam.remark = inparam.remark || Model.StringValue

        // inparam.companyRegion = inparam.companyRegion ? inparam.companyRegion.toString() : Model.StringValue
        // inparam.companyContract = inparam.companyContract || Model.StringValue
        // inparam.license = inparam.license || Model.StringValue

        return [checkAttError, errorParams]
    }
}

module.exports = CompanyCheck