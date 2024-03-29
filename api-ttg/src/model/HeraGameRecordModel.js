const moment = require('moment')
const BaseModel = require('./BaseModel')

/**
 * 战绩表实体
 */
class HeraGameRecordModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: 'HeraGameRecord'
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }

    /**
     * 单条写入注单战绩
     * @param {*} item 
     * status==3不会提供给商户查询
     */
    writeRound(item) {
        let betTime = item.createdAt
        let createdAt = item.retAt || item.createdAt
        return this.putItem({
            userId: +item.userId,
            userName: item.userName,
            betId: item.businessKey,
            betTime,
            createdAt,
            createdStr: moment(createdAt).utcOffset(8).format('YYYY-MM-DD HH:mm:ss'),
            gameId: item.gameId ? item.gameId.toString() : item.gameType.toString(),
            gameType: +item.gameType,
            parentId: item.parent,
            status: item.status || 4,
            record: {
                content: item.content,
                anotherGameData: item.anotherGameData
            }
        })
    }
}

module.exports = HeraGameRecordModel