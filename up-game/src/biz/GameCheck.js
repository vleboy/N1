const Util = require("../lib/athena").Util
const RegEnum = require("../lib/athena").RegEnum
const Model = require('../lib/Model').Model
const GameStatusEnum = require('../lib/Consts').GameStatusEnum
const GameTypeEnum = require('../lib/Consts').GameTypeEnum
class GameCheck {
    /**
     * 检查游戏数据
     */
    checkGame(inparam) {
        let checkArr = [
            { name: "gameName", type: "S", min: 2, max: 30 },
            { name: "gameRecommend", type: "S", min: 2, max: 200 },
            { name: "gameType", type: "N", min: 10000, max: 99999999 },
            // { name: "ip", type: "NREG", min: null, max: null, equal: RegEnum.IP },
            // { name: "port", type: "NN", min: 1, max: 65535 },
            //{ name: "kindId", type: "N", min: 10000, max: 99999999 },
            { name: "gameIden", type: "REG", min: null, max: null, equal: RegEnum.GAMEIDEN },
            { name: "gameImg", type: "NREG", min: null, max: null, equal: RegEnum.URL }
        ]
        // if (inparam.isWebGame == 1) {
        //     checkArr.push({ name: "gameLink", type: "NREG", min: null, max: null, equal: RegEnum.URL })
        // }
        let [checkAttError, errorParams] = Util.checkProperties(checkArr, inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 检查子对象
        if (!inparam.company || !inparam.company.companyName || !inparam.company.companyId) {
            throw { "code": -1, "msg": "游戏厂商数据不合法", "params": ["company"] }
        }

        // 数据类型处理
        inparam.gameType = inparam.gameType.toString()
        // inparam.kindId = inparam.kindId.toString()
        inparam.kindId = (parseInt(inparam.kindId) + parseInt(inparam.gameType)).toString()
        inparam.gameStatus = GameStatusEnum.Online
        inparam.gameImg = inparam.gameImg || Model.StringValue
        inparam.gameImgAli = inparam.gameImgAli || Model.StringValue
        inparam.company = inparam.company || Model.StringValue

        // 精细检查
        if (!GameTypeEnum[inparam.gameType]) {
            throw { "code": -1, "msg": "游戏类型不合法", "params": ["gameType"] }
        }
        if (inparam.gameType.charAt(0) != inparam.kindId.charAt(0)) {
            throw { "code": -1, "msg": "kindId必须与游戏类型一致", "params": ["kindId"] }
        }

        return [checkAttError, errorParams]
    }

    /**
     * 检查游戏状态变更入参
     * @param {*} inparam 
     */
    checkStatus(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "gameType", type: "N", min: 10000, max: 99999999 },
            { name: "gameId", type: "S", min: 36, max: 36 },
            { name: "status", type: "N", min: 0, max: 1 }]
            , inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 数据类型处理
        inparam.status = parseInt(inparam.status)

        // 精细检查
        if (!GameTypeEnum[inparam.gameType]) {
            throw { "code": -1, "msg": "游戏类型不合法", "params": ["gameType"] }
        }

        return [checkAttError, errorParams]
    }
    /**    
     *游戏排序
     * @param {*} inparam 
     */
    checkOrder(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "gameType", type: "N", min: 10000, max: 99999999 },
            { name: "gameId", type: "S", min: 36, max: 36 },
            { name: "sortOrder", type: "N", min: 0, max: 100000 }]
            , inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        inparam.sortOrder = +inparam.sortOrder
    }

    /**
     * 检查查询
     * @param {*} inparam 
     */
    checkQuery(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "gameType", type: "NS", min: 5, max: 170 }]
            , inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 如果类型参数为空，默认查询所有类型
        // if (!inparam.gameType) {
        //     inparam.gameType = ''
        //     for (let item in GameTypeEnum) {
        //         inparam.gameType += (item + ',')
        //     }
        //     inparam.gameType = inparam.gameType.substr(0, inparam.gameType.length - 1)
        // }

        // 数据类型处理
        if (inparam.gameType) {
            inparam.gameType = inparam.gameType.toString()
        }
        // inparam.keyword = inparam.keyword || null
        return [checkAttError, errorParams]
    }


    /**
     * 检查更新的游戏数据
     */
    checkUpdateGame(inparam) {
        let checkArr = [
            { name: "gameName", type: "S", min: 2, max: 30 },
            { name: "gameRecommend", type: "S", min: 2, max: 200 },
            { name: "gameType", type: "N", min: 10000, max: 99999999 },
            // { name: "ip", type: "NREG", min: null, max: null, equal: RegEnum.IP },
            // { name: "port", type: "NN", min: 1, max: 65535 },
            //{ name: "kindId", type: "N", min: 10000, max: 99999999 },
            { name: "gameIden", type: "REG", min: null, max: null, equal: RegEnum.GAMEIDEN },
            { name: "gameImg", type: "NREG", min: null, max: null, equal: RegEnum.URL }
        ]
        // if (inparam.isWebGame == 1) {
        //     checkArr.push({ name: "gameLink", type: "NREG", min: null, max: null, equal: RegEnum.URL })
        // }
        let [checkAttError, errorParams] = Util.checkProperties(checkArr, inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }

        // 检查子对象
        if (!inparam.company || !inparam.company.companyName || !inparam.company.companyId) {
            throw { "code": -1, "msg": "游戏厂商数据不合法", "params": ["company"] }
        }

        // 数据类型处理
        inparam.gameType = inparam.gameType.toString()
        // inparam.kindId = inparam.kindId.toString()
        if (parseInt(inparam.kindId) < 99999) {
            inparam.kindId = (parseInt(inparam.gameType) + parseInt(inparam.kindId)).toString()
        } else {
            inparam.kindId = inparam.gameType.toString().substring(0, 3) + inparam.kindId.toString()
        }
        inparam.gameStatus = GameStatusEnum.Online
        inparam.gameImg = inparam.gameImg || Model.StringValue
        inparam.gameImgAli = inparam.gameImgAli || Model.StringValue
        inparam.company = inparam.company || Model.StringValue

        // 精细检查
        if (!GameTypeEnum[inparam.gameType]) {
            throw { "code": -1, "msg": "游戏类型不合法", "params": ["gameType"] }
        }
        if (inparam.gameType.charAt(0) != inparam.kindId.charAt(0)) {
            throw { "code": -1, "msg": "kindId必须与游戏类型一致", "params": ["kindId"] }
        }

        return [checkAttError, errorParams]
    }
}

module.exports = GameCheck