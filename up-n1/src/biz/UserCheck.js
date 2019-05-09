const Util = require("../lib/athena").Util
const RegEnum = require('../lib/athena').RegEnum
const Model = require('../lib/Model').Model
const RoleCodeEnum = require('../lib/UserConsts').RoleCodeEnum
class UserCheck {
    /**
     * 检查管理员
     */
    checkAdmin(inparam) {
        if (passwordLevel(inparam.password) < 2) {
            throw { "code": -1, "msg": "密码强度不足", "params": ["password"] }
        }
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "role", type: "N", min: 1, max: 1 },
            { name: "username", type: "REG", min: null, max: null, equal: RegEnum.USERNAME },
            { name: "password", type: "S", min: 6, max: 16 },
            { name: "adminName", type: "REG", min: null, max: null, equal: RegEnum.HOSTNAME },
            { name: "adminContact", type: "S", min: 1, max: 40 },
            { name: "adminEmail", type: "REG", min: null, max: null, equal: RegEnum.EMAIL },

            // { name: "displayName", type: "NREG", min: null, max: null, equal: RegEnum.DISPLAYNAME },
            // { name: "hostName", type: "NREG", min: null, max: null, equal: RegEnum.HOSTNAME },
            // { name: "hostContact", type: "NS", min: 5, max: 40 },

            { name: "remark", type: "NS", min: 1, max: 200 }
        ], inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 数据类型处理
        inparam.role = inparam.role.toString()
        inparam.level = 0
        inparam.levelIndex = '0'
        return [checkAttError, errorParams]
    }
    /**
     * 检查普通用户
     */
    checkUser(inparam) {
        if (passwordLevel(inparam.password) < 2) {
            throw { "code": -1, "msg": "密码强度不足", "params": ["password"] }
        }
        let [checkAttError, errorParams] = [0, 0]
        if (inparam.role == RoleCodeEnum.Manager) {                                         //线路商注册校验
            [checkAttError, errorParams] = Util.checkProperties([
                { name: "suffix", type: "REG", min: null, max: null, equal: RegEnum.SUFFIX },
                { name: "username", type: "REG", min: null, max: null, equal: RegEnum.USERNAME },
                { name: "password", type: "S", min: 6, max: 16 },
                { name: "points", type: "REG", min: null, max: null, equal: RegEnum.PRICE },
                { name: "displayName", type: "REG", min: null, max: null, equal: RegEnum.DISPLAYNAME },
                { name: "remark", type: "NS", min: 1, max: 200 }
            ], inparam)
        } else if (inparam.role == RoleCodeEnum.Merchant) {                                 //商户注册校验
            [checkAttError, errorParams] = Util.checkProperties([
                { name: "sn", type: "REG", min: null, max: null, equal: RegEnum.SN },
                { name: "displayName", type: "REG", min: null, max: null, equal: RegEnum.DISPLAYNAME },
                { name: "username", type: "REG", min: null, max: null, equal: RegEnum.USERNAME },
                { name: "password", type: "S", min: 6, max: 16 },
                { name: "points", type: "REG", min: null, max: null, equal: RegEnum.PRICE },
                { name: "remark", type: "NS", min: 1, max: 200 }
                // { name: "suffix", type: "REG", min: null, max: null, equal: RegEnum.SUFFIX },
            ], inparam)
            //将sn的值赋给suffix
            inparam.suffix = inparam.sn
            // inparam.skin = inparam.skin || '1'
        }
        if (inparam.parent != '01' && inparam.parent.length != 36) {
            throw { "code": -1, "msg": "父级id不正确", "params": ["parent"] }
        }
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        if (!inparam.gameList || inparam.gameList.length == 0) {
            throw { "code": -1, "msg": "你还没有选择游戏", "params": ["gameList"] }
        }
        if (!inparam.parent) {
            inparam.parent = Model.DefaultParent
        }
        // 默认数据类型处理
        inparam.points = parseFloat(inparam.points)
        inparam.role = inparam.role.toString()
        // if (inparam.launchImg) {
        //     if ((typeof inparam.launchImg) != 'object' || (!inparam.launchImg.logo || inparam.launchImg.logo.length != 2) || (!inparam.launchImg.name || inparam.launchImg.name.length != 2)) {
        //         throw { "code": -1, "msg": "图片上传的格式不规范", "params": ["launchImg"] }
        //     }
        // } else {
        //     inparam.launchImg = {
        //         logo: ['https://s3-ap-southeast-1.amazonaws.com/image-na-dev/NAlogo.png', 'http://assetdownload.oss-cn-hangzhou.aliyuncs.com/image/NAlogo.png'],
        //         name: ['https://s3-ap-southeast-1.amazonaws.com/image-na-dev/dating-nagaming.png', 'http://assetdownload.oss-cn-hangzhou.aliyuncs.com/image/dating-nagaming.png']
        //     }
        // }
        // inparam.isOpenBrowser = inparam.isOpenBrowser ? 1 : 0
        return [checkAttError, errorParams]
    }

    /**
     * 检查普通用户更新
     */
    checkUserUpdate(inparam) {
        if (inparam.password && passwordLevel(inparam.password) < 2) {
            throw { "code": -1, "msg": "密码强度不足", "params": ["password"] }
        }
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "password", type: "NS", min: 6, max: 16 },
            { name: "remark", type: "NS", min: 1, max: 200 }]
            , inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // if (inparam.launchImg) {
        //     if ((typeof inparam.launchImg) != 'object' || (!inparam.launchImg.logo || inparam.launchImg.logo.length != 2) || (!inparam.launchImg.name || inparam.launchImg.name.length != 2)) {
        //         throw { "code": -1, "msg": "图片上传的格式不规范", "params": ["launchImg"] }
        //     }
        // }
        if (inparam.gameList && inparam.gameList.length == 0) {
            throw { "code": -1, "msg": "游戏列表不能为空", "params": ["gameList"] }
        }
        // 数据类型处理
        // inparam.isOpenBrowser = inparam.isOpenBrowser ? 1 : 0
        inparam.isTest = inparam.isTest ? 1 : 0         //如果isTest传1表示为测试账号 不传或者传0为正式账号
        if (!inparam.parent) {
            inparam.parent = Model.DefaultParent
        }
        // inparam.skin = inparam.skin || '1'
        // inparam.skin = inparam.skin.toString()
        //是否设置成测试账号
        return [checkAttError, errorParams]
    }

    /**
     * 检查登录
     * @param {*} inparam 
     */
    checkLogin(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "role", type: "N", min: 1, max: 100 },
            { name: "username", type: "REG", min: null, max: null, equal: RegEnum.USERNAME },
            { name: "suffix", type: "NREG", min: null, max: null, equal: RegEnum.SUFFIX },
            { name: "sn", type: "NS", min: 1, max: 10 }
        ], inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // 数据类型处理
        inparam.role = inparam.role.toString()
    }

    /**
     * 检查用户状态变更入参
     * @param {*} inparam 
     */
    checkStatus(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "userId", type: "S", min: 36, max: 36 },
            { name: "role", type: "N", min: 1, max: 100 },
            { name: "status", type: "NN", min: 0, max: 1 },
            { name: "switch", type: "NN", min: 0, max: 1 }]
            , inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        if (inparam.companyList && inparam.companyList.length == 0) {
            throw { "code": -1, "msg": "运营商列表不能为空", "params": ["companyList"] }
        }
        // 数据类型处理
        if (inparam.status) {
            inparam.status = parseInt(inparam.status)
        }
        return [checkAttError, errorParams]
    }

    /**
     * 检查用户密码变更
     * @param {*} inparam 
     */
    checkPassword(inparam) {
        if (passwordLevel(inparam.password) < 2) {
            throw { "code": -1, "msg": "密码强度不足", "params": ["password"] }
        }
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "userId", type: "S", min: 36, max: 36 },
            { name: "password", type: "S", min: 6, max: 16 }]
            , inparam)
        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        return [checkAttError, errorParams]
    }

    /**
     * 检查sn
     * @param {*} inparam 
     */
    checkSn(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "sn", type: "S", min: 1, max: 10 }]
            , inparam)
        return [checkAttError, errorParams]
    }

}

/**
 * 返回密码强度等级
 * @param {*} password 
 */
function passwordLevel(password) {
    var Modes = 0;
    for (let i = 0; i < password.length; i++) {
        Modes |= CharMode(password.charCodeAt(i));
    }
    return bitTotal(Modes);
    //CharMode函数
    function CharMode(iN) {
        if (iN >= 48 && iN <= 57)//数字
            return 1;
        if (iN >= 65 && iN <= 90) //大写字母
            return 2;
        if ((iN >= 97 && iN <= 122) || (iN >= 65 && iN <= 90))
            //大小写
            return 4;
        else
            return 8; //特殊字符
    }
    //bitTotal函数
    function bitTotal(num) {
        let modes = 0;
        for (let i = 0; i < 4; i++) {
            if (num & 1) modes++;
            num >>>= 1;
        }
        return modes;
    }
}

module.exports = UserCheck