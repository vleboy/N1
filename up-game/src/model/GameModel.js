const GameTypeEnum = require('../lib/Consts').GameTypeEnum
const BizErr = require('../lib/Codes').BizErr
const Model = require('../lib/Model').Model
const GlobalConfig = require("../util/config")
const BaseModel = require('./BaseModel')
const _ = require('lodash')
const uuid = require('uuid/v4')
class GameModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.DianaPlatformGame,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            gameType: Model.StringValue,
            gameId: uuid()
        }
    }

    /**
     * 添加游戏
     * @param {*} gameInfo 
     */
    async addGame(gameInfo) {
        // 判断是否重复
        let exist = await this.isExist({
            IndexName: 'GameNameIndex',
            KeyConditionExpression: 'gameType = :gameType and gameName = :gameName',
            ExpressionAttributeValues: {
                ':gameType': gameInfo.gameType,
                ':gameName': gameInfo.gameName
            }
        })
        if (exist) {
            throw BizErr.ItemExistErr()
        }
        // 判断kindId是否重复
        exist = await this.isExist({
            IndexName: 'KindIdIndex',
            KeyConditionExpression: 'kindId = :kindId',
            ExpressionAttributeValues: {
                ':kindId': gameInfo.kindId,
            }
        })
        if (exist) {
            throw BizErr.ItemExistErr('KindId已存在')
        }
        // 保存
        const item = {
            ...this.item,
            ...gameInfo
        }
        const putRet = await this.putItem(item)
        return item
    }

    /**
     * 游戏列表
     * @param {*} inparam 
     */
    async listGames(inparam) {
        // 分割类型
        const inputTypes = inparam.gameType.split(',')
        const gameTypes = _.filter(inputTypes, (type) => {
            return !!GameTypeEnum[type].code
        })
        if (gameTypes.length === 0) {
            throw BizErr.ParamErr('game type is missing')
        }
        // 1、组装条件
        let ranges = _.map(gameTypes, (t, index) => {
            return `gameType = :t${index}`
        }).join(' OR ')
        ranges = '(' + ranges + ')'
        // 添加查询条件
        inparam.keyword ? ranges += ' AND contains(gameName,:gameName)' : 0
        // 2、组装条件值
        const values = _.reduce(gameTypes, (result, t, index) => {
            result[`:t${index}`] = t
            return result
        }, {})
        inparam.keyword ? values[':gameName'] = inparam.keyword : 0

        let query = {
            FilterExpression: ranges,
            ExpressionAttributeValues: values
        }
        // 条件搜索
        if (!_.isEmpty(inparam.query)) {
            if (inparam.query.gameStatus) { inparam.query.gameStatus = parseInt(inparam.query.gameStatus) }
            if (inparam.query.companyIden) { inparam.query.companyIden = { $like: inparam.query.companyIden } }
            if (inparam.query.gameName) { inparam.query.gameName = { $like: inparam.query.gameName } }
        }
        const ret = await this.bindFilterScan(query, inparam.query, false)
        return ret.Items
    }

    /**
     * 高效游戏列表
     * @param {*} inparam 
     */
    async list(inparam) {
        // 条件搜索
        if (!_.isEmpty(inparam.query)) {
            if (inparam.query.gameStatus) { inparam.query.gameStatus = parseInt(inparam.query.gameStatus) }
            if (inparam.query.gameName) { inparam.query.gameName = { $like: inparam.query.gameName } }
        }
        let ret = {}
        // 全部查询
        if (!inparam.gameType) {
            let scanData = {
                ProjectionExpression: 'gameId,companyIden,gameType,gameName,kindId,gameLink,gameStatus,gameImg,gameImgAli,sortOrder'
            }
            if (inparam.query) {
                scanData.FilterExpression = ''
                scanData.ExpressionAttributeValues = ''
                ret = await this.bindFilterScan(scanData, inparam.query, false)
            } else {
                ret = await this.scan(scanData)
            }
            return _.orderBy(ret.Items, ['sortOrder', 'gameStatus', 'createdAt'], ['asc', 'desc', 'asc'])
        }
        // 查询指定大类游戏
        let query = {
            ProjectionExpression: 'companyIden,gameType,gameName,kindId,gameLink,gameStatus,gameImg,gameImgAli,sortOrder',
            KeyConditionExpression: 'gameType = :gameType',
            ExpressionAttributeValues: {
                ':gameType': inparam.gameType
            }
        }
        ret = await this.bindFilterQuery(query, inparam.query, false)
        return _.orderBy(ret.Items, ['sortOrder', 'gameStatus', 'createdAt'], ['asc', 'desc', 'asc'])
    }

    /**
     * 更新游戏状态
     * @param {游戏类型} gameType 
     * @param {游戏ID} gameId 
     * @param {需要变更的状态} status 
     */
    async changeStatus(gameType, gameId, status) {
        const ret = await this.updateItem({
            ...this.params,
            Key: {
                'gameType': gameType,
                'gameId': gameId
            },
            UpdateExpression: "SET gameStatus = :status",
            ExpressionAttributeValues: {
                ':status': status
            }
        })
        return ret
    }
    /**
     * 查询单个游戏
     * @param {*} gameType 
     * @param {*} gameId 
     */
    async getOne(gameType, gameId) {
        const ret = await this.query({
            KeyConditionExpression: 'gameType = :gameType and gameId = :gameId',
            ExpressionAttributeValues: {
                ':gameType': gameType,
                ':gameId': gameId
            }
        })
        if (ret.Items.length > 0) {
            return ret.Items[0]
        } else {
            return 0
        }
    }

    /**
     * 查询游戏的厂商对应的游戏
     * @param {*} inparam 
     */
    async getByCompanyId(inparam) {
        const ret = await this.scan({
            FilterExpression: 'company.companyId = :companyId',
            ExpressionAttributeValues: {
                ':companyId': inparam.companyId,
            }
        })
        return ret
    }

    /**
     * 根据gameType获取单个游戏
     * @param {*} inparam 
     */
    async findSingleByType(gameType) {
        const ret = await this.scan({
            FilterExpression: 'gameType = :gameType',
            ExpressionAttributeValues: {
                ':gameType': gameType
            }
        })
        return (ret.Items || [])[0]
    }
    /**
     * 根据kindId查询游戏
     * @param {*} kindId 
     */
    async findByKindId(kindId) {
        const ret = await this.scan({
            FilterExpression: 'kindId = :kindId',
            ExpressionAttributeValues: {
                ':kindId': kindId
            }
        })
        return (ret.Items || [])[0]
    }
    /**
     * 更新
     * @param {*} inparam 
     */
    async updateGame(inparam) {
        // 更新
        const ret = await this.getOne(inparam.gameType, inparam.gameId)
        if (!ret) {
            throw BizErr.ItemNotExistErr()
        }
        inparam.createdAt = ret.createdAt
        inparam.createdDate = ret.createdDate
        inparam.sortOrder = ret.sortOrder
        return await this.putItem(inparam)
    }

}


module.exports = GameModel

