const BaseModel = require('./BaseModel')
const GlobalConfig = require("../util/config")
const _ = require('lodash')
class SysTransferModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.SYSTransfer,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
    //查询流水
    async queryDetailPage(inparam, isPage = true) {
        let query = {}          //查询条件
        let filterParms = {}    //过滤条件
        if (inparam.plat) {
            query = {
                IndexName: 'PlatIndex',
                KeyConditionExpression: 'plat = :plat AND createdAt between :createdAt0 and :createdAt1',
                ProjectionExpression: 'amount,sn,businessKey,createdAt,gameType,gameId,balance,plat,#status,#type,userId,userNick',
                ExpressionAttributeNames: {
                    '#status': 'status',
                    '#type': 'type'
                },
                ExpressionAttributeValues: {
                    ':plat': inparam.plat,
                    ':createdAt0': inparam.startTime,
                    ':createdAt1': inparam.endTime
                }
            }
        }
        if (inparam.userId) {
            query = {
                IndexName: 'UserIdIndex',
                KeyConditionExpression: 'userId = :userId AND createdAt between :createdAt0 and :createdAt1',
                ProjectionExpression: 'amount,sn,businessKey,createdAt,gameType,gameId,balance,plat,#status,#type,userId,userNick',
                ExpressionAttributeNames: {
                    '#status': 'status',
                    '#type': 'type'
                },
                ExpressionAttributeValues: {
                    ':userId': inparam.userId,
                    ':createdAt0': inparam.startTime,
                    ':createdAt1': inparam.endTime
                }
            }
            //如果传了userId 又传了plat 则 plat要作为flater筛选条件
            if (inparam.plat) {
                filterParms.plat = inparam.plat
            }
        }
        if (inparam.businessKey) {
            query = {
                KeyConditionExpression: 'businessKey = :businessKey',
                ProjectionExpression: 'amount,sn,businessKey,createdAt,gameType,gameId,balance,plat,#status,#type,userId,userNick',
                ExpressionAttributeNames: {
                    '#status': 'status',
                    '#type': 'type'
                },
                ExpressionAttributeValues: {
                    ':businessKey': inparam.businessKey,
                }
            }
            //sn存在 则查询某一个具体的流水
            if (inparam.sn) {
                query.KeyConditionExpression = 'businessKey = :businessKey AND sn = :sn'
                query.ExpressionAttributeValues = {
                    ':businessKey': inparam.businessKey,
                    ':sn': inparam.sn
                }
            }
        }
        //过滤
        if (inparam.status) {
            filterParms.status = inparam.status
        }
        if (inparam.gameType) {
            filterParms.gameType = inparam.gameType
        }
        if (isPage) {
            //定义查询条数
            inparam.pageSize = inparam.pageSize ? inparam.pageSize : 200
            //分页查询
            return await this.bindFilterPage(query, filterParms, false, inparam)
        } else {
            return await this.bindFilterQuery(query, filterParms, false)
        }

    }

}


module.exports = SysTransferModel