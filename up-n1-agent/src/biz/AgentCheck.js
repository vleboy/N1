const Model = require('../lib/UserConsts').Model
const RoleCodeEnum = require('../lib/UserConsts').RoleCodeEnum
const Util = require("../lib/athena").Util
const RegEnum = require("../lib/athena").RegEnum

class AgentCheck {
    /**
     * 检查代理管理员
     */
    checkAdmin(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "role", type: "N", min: 1000, max: 1000 },
            { name: "username", type: "REG", min: null, max: null, equal: RegEnum.USERNAME },
            { name: "rate", type: "NREG", min: null, max: null, equal: RegEnum.RATE },
            { name: "remark", type: "NS", min: 1, max: 200 }]
            , inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // 数据类型处理
        inparam.points = parseFloat(Model.PlatformAdminDefaultPoints)
        inparam.role = RoleCodeEnum.Agent
        inparam.suffix = 'Agent'
        inparam.displayName = '代理管理员'
        inparam.parent = Model.NoParent
        inparam.parentName = Model.NoParentName
        inparam.level = 0
        inparam.levelIndex = '0'
        inparam.rate = 100.00
    }
    /**
     * 检查代理
     */
    check(inparam) {
        let checkInparm = [
            { name: "role", type: "N", min: 1000, max: 1000 },
            { name: "rate", type: "REG", min: null, max: null, equal: RegEnum.RATE },
            { name: "points", type: "REG", min: null, max: null, equal: RegEnum.PRICE },
            { name: "displayName", type: "REG", min: null, max: null, equal: RegEnum.DISPLAYNAME },
            { name: "sn", type: "REG", min: null, max: null, equal: RegEnum.SN },
            { name: "remark", type: "NS", min: 1, max: 200 }]
        let [checkAttError, errorParams] = Util.checkProperties(checkInparm, inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // 数据类型处理
        if (!inparam.gameList || inparam.gameList.length == 0) {
            throw { "code": -1, "msg": "游戏数组不能为空", "params": ["gameList"] }
        }
        inparam.rate = parseFloat(inparam.rate)
        inparam.points = parseFloat(inparam.points)
        inparam.role = RoleCodeEnum.Agent
        inparam.suffix = Model.StringValue
    }

    /**
     * 检查代理更新
     */
    checkUpdate(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "role", type: "N", min: 1000, max: 1000 },
            { name: "password", type: "S", min: 6, max: 16 },
            { name: "displayName", type: "REG", min: null, max: null, equal: RegEnum.DISPLAYNAME },
            { name: "rate", type: "REG", min: null, max: null, equal: RegEnum.RATE },
            { name: "points", type: "REG", min: null, max: null, equal: RegEnum.PRICE },
            { name: "remark", type: "NS", min: 1, max: 200 }]
            , inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // 数据类型处理
        inparam.rate = parseFloat(inparam.rate)
        inparam.points = parseFloat(inparam.points)
        inparam.role = RoleCodeEnum.Agent
        inparam.suffix = Model.StringValue
        inparam.isTest = inparam.isTest ? 1 : 0         //如果isTest传1表示为测试账号 不传或者传0为正式账号
    }

    /**
     * 检查登录
     * @param {*} inparam 
     */
    checkLogin(inparam) {
        // 数据类型处理
        inparam.role = inparam.role.toString()
        // inparam.captcha = parseInt(inparam.captcha)
    }

    /**
     * 检查用户状态变更入参
     * @param {*} inparam 
     */
    checkStatus(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "userId", type: "S", min: 36, max: 36 },
            { name: "status", type: "N", min: 0, max: 1 }]
            , inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // 数据类型处理
        inparam.status = parseInt(inparam.status)
    }

    /**
     * 检查限红入参
     * @param {*} inparam 
     */
    checkChip(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "userId", type: "S", min: 36, max: 36 }]
            , inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
    }

    /**
     * 检查用户密码变更
     * @param {*} inparam 
     */
    checkPassword(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "userId", type: "S", min: 36, max: 36 },
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
    }

    /**
     * 检查查询代理列表
     * @param {*} inparam 
     */
    checkQueryList(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "parent", type: "S", min: 2, max: 36 }]
            , inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
    }
}

// /**
//  * 返回密码强度等级
//  * @param {*} password 
//  */
// function passwordLevel(password) {
//     var Modes = 0;
//     for (let i = 0; i < password.length; i++) {
//         Modes |= CharMode(password.charCodeAt(i));
//     }
//     return bitTotal(Modes);
//     //CharMode函数
//     function CharMode(iN) {
//         if (iN >= 48 && iN <= 57)//数字
//             return 1;
//         if (iN >= 65 && iN <= 90) //大写字母
//             return 2;
//         if ((iN >= 97 && iN <= 122) || (iN >= 65 && iN <= 90))
//             //大小写
//             return 4;
//         else
//             return 8; //特殊字符
//     }
//     //bitTotal函数
//     function bitTotal(num) {
//         let modes = 0;
//         for (let i = 0; i < 4; i++) {
//             if (num & 1) modes++;
//             num >>>= 1;
//         }
//         return modes;
//     }
// }

module.exports = AgentCheck