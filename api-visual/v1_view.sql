drop view if exists `v_round`;
create view v_round as 
select parent,company,round(sum(winloseAmount),2) as winloseAmount 
from round where createdAt > 1554048000000 group by parent,company;

-- 按照商户，游戏大类分组
drop view if exists `v_round_parent_gametype_createddate`;
create view v_round_parent_gametype_createddate as 
select parent,parentDisplayName,gameType,createdDate,
ROUND(sum(betCount),2) as betCount,
ROUND(sum(betAmount),2) as betAmount,
ROUND(sum(winAmount),2) as winAmount,
ROUND(sum(refundAmount),2) as refundAmount,
ROUND(sum(retAmount),2) as retAmount,
ROUND(sum(winloseAmount),2) as winloseAmount 
from round group by parent,parentDisplayName,gameType,createdDate
order by createdDate;

drop view if exists `v_round_parent_gametype_createdweek`;
create view v_round_parent_gametype_createdweek as 
select parent,parentDisplayName,gameType,createdWeek,
ROUND(sum(betCount),2) as betCount,
ROUND(sum(betAmount),2) as betAmount,
ROUND(sum(winAmount),2) as winAmount,
ROUND(sum(refundAmount),2) as refundAmount,
ROUND(sum(retAmount),2) as retAmount,
ROUND(sum(winloseAmount),2) as winloseAmount 
from round group by parent,parentDisplayName,gameType,createdWeek
order by createdWeek;

drop view if exists `v_round_parent_gametype_createdmonth`;
create view v_round_parent_gametype_createdmonth as 
select parent,parentDisplayName,gameType,createdMonth,
ROUND(sum(betCount),2) as betCount,
ROUND(sum(betAmount),2) as betAmount,
ROUND(sum(winAmount),2) as winAmount,
ROUND(sum(refundAmount),2) as refundAmount,
ROUND(sum(retAmount),2) as retAmount,
ROUND(sum(winloseAmount),2) as winloseAmount 
from round group by parent,parentDisplayName,gameType,createdMonth
order by createdMonth;

-- 按照商户分组
drop view if exists `v_round_parent_createddate`;
create view v_round_parent_createddate as 
select parent,parentDisplayName,createdDate,
ROUND(sum(betCount),2) as betCount,
ROUND(sum(betAmount),2) as betAmount,
ROUND(sum(winAmount),2) as winAmount,
ROUND(sum(refundAmount),2) as refundAmount,
ROUND(sum(retAmount),2) as retAmount,
ROUND(sum(winloseAmount),2) as winloseAmount 
from round group by parent,parentDisplayName,createdDate
order by createdDate;

drop view if exists `v_round_parent_createdweek`;
create view v_round_parent_createdweek as 
select parent,parentDisplayName,createdWeek,
ROUND(sum(betCount),2) as betCount,
ROUND(sum(betAmount),2) as betAmount,
ROUND(sum(winAmount),2) as winAmount,
ROUND(sum(refundAmount),2) as refundAmount,
ROUND(sum(retAmount),2) as retAmount,
ROUND(sum(winloseAmount),2) as winloseAmount 
from round group by parent,parentDisplayName,createdWeek
order by createdWeek;

drop view if exists `v_round_parent_createdmonth`;
create view v_round_parent_createdmonth as 
select parent,parentDisplayName,createdMonth,
ROUND(sum(betCount),2) as betCount,
ROUND(sum(betAmount),2) as betAmount,
ROUND(sum(winAmount),2) as winAmount,
ROUND(sum(refundAmount),2) as refundAmount,
ROUND(sum(retAmount),2) as retAmount,
ROUND(sum(winloseAmount),2) as winloseAmount 
from round group by parent,parentDisplayName,createdMonth
order by createdMonth;

-- 按照游戏大类分组
drop view if exists `v_round_gametype_createddate`;
create view v_round_gametype_createddate as 
select gameType,createdDate,
ROUND(sum(betCount),2) as betCount,
ROUND(sum(betAmount),2) as betAmount,
ROUND(sum(winAmount),2) as winAmount,
ROUND(sum(refundAmount),2) as refundAmount,
ROUND(sum(retAmount),2) as retAmount,
ROUND(sum(winloseAmount),2) as winloseAmount 
from round group by gameType,createdDate
order by createdDate;

drop view if exists `v_round_gametype_createdweek`;
create view v_round_gametype_createdweek as 
select gameType,createdWeek,
ROUND(sum(betCount),2) as betCount,
ROUND(sum(betAmount),2) as betAmount,
ROUND(sum(winAmount),2) as winAmount,
ROUND(sum(refundAmount),2) as refundAmount,
ROUND(sum(retAmount),2) as retAmount,
ROUND(sum(winloseAmount),2) as winloseAmount 
from round group by gameType,createdWeek
order by createdWeek;

drop view if exists `v_round_gametype_createdmonth`;
create view v_round_gametype_createdmonth as 
select gameType,createdMonth,
ROUND(sum(betCount),2) as betCount,
ROUND(sum(betAmount),2) as betAmount,
ROUND(sum(winAmount),2) as winAmount,
ROUND(sum(refundAmount),2) as refundAmount,
ROUND(sum(retAmount),2) as retAmount,
ROUND(sum(winloseAmount),2) as winloseAmount 
from round group by gameType,createdMonth
order by createdMonth;

-- 商户分组玩家人数
drop view if exists `v_round_parent_playercount_createddate`;
create view v_round_parent_playercount_createddate as 
select t.parent,t.parentDisplayName,t.createdDate,count(t.userId) as playerCount from
(select distinct(userId),parent,parentDisplayName,createdDate from round) as t
group by t.parent,t.parentDisplayName,t.createdDate
order by t.createdDate;

drop view if exists `v_round_parent_playercount_createdweek`;
create view v_round_parent_playercount_createdweek as 
select t.parent,t.parentDisplayName,t.createdWeek,count(t.userId) as playerCount from
(select distinct(userId),parent,parentDisplayName,createdWeek from round) as t
group by t.parent,t.parentDisplayName,t.createdWeek
order by t.createdWeek;

drop view if exists `v_round_parent_playercount_createdmonth`;
create view v_round_parent_playercount_createdmonth as 
select t.parent,t.parentDisplayName,t.createdMonth,count(t.userId) as playerCount from
(select distinct(userId),parent,parentDisplayName,createdMonth from round) as t
group by t.parent,t.parentDisplayName,t.createdMonth
order by t.createdMonth;

-- 游戏分组玩家人数
drop view if exists `v_round_gametype_playercount_createddate`;
create view v_round_gametype_playercount_createddate as 
select t.gameType,t.createdDate,count(t.userId) as playerCount from
(select distinct(userId),gameType,createdDate from round) as t
group by t.gameType,t.createdDate
order by t.createdDate;

drop view if exists `v_round_gametype_playercount_createdweek`;
create view v_round_gametype_playercount_createdweek as 
select t.gameType,t.createdWeek,count(t.userId) as playerCount from
(select distinct(userId),gameType,createdWeek from round) as t
group by t.gameType,t.createdWeek
order by t.createdWeek;

drop view if exists `v_round_gametype_playercount_createdmonth`;
create view v_round_gametype_playercount_createdmonth as 
select t.gameType,t.createdMonth,count(t.userId) as playerCount from
(select distinct(userId),gameType,createdMonth from round) as t
group by t.gameType,t.createdMonth
order by t.createdMonth;

-- 商户，游戏大类分组玩家人数
drop view if exists `v_round_parent_gametype_playercount_createddate`;
create view v_round_parent_gametype_playercount_createddate as 
select t.parent,t.parentDisplayName,t.gameType,t.createdDate,count(t.userId) as playerCount from
(select distinct(userId),parent,parentDisplayName,gameType,createdDate from round) as t
group by t.parent,t.parentDisplayName,t.gameType,t.createdDate
order by t.createdDate;

drop view if exists `v_round_parent_gametype_playercount_createdweek`;
create view v_round_parent_gametype_playercount_createdweek as 
select t.parent,t.parentDisplayName,t.gameType,t.createdWeek,count(t.userId) as playerCount from
(select distinct(userId),parent,parentDisplayName,gameType,createdWeek from round) as t
group by t.parent,t.parentDisplayName,t.createdWeek
order by t.createdWeek;

drop view if exists `v_round_parent_gametype_playercount_createdmonth`;
create view v_round_parent_gametype_playercount_createdmonth as 
select t.parent,t.parentDisplayName,t.gameType,t.createdMonth,count(t.userId) as playerCount from
(select distinct(userId),parent,parentDisplayName,gameType,createdMonth from round) as t
group by t.parent,t.parentDisplayName,t.gameType,t.createdMonth
order by t.createdMonth;