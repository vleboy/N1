-- Adminer 4.7.1 MySQL dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

SET NAMES utf8mb4;

DROP DATABASE IF EXISTS `v1`;
CREATE DATABASE `v1` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */;
USE `v1`;

DROP TABLE IF EXISTS `bill`;
CREATE TABLE `bill` (
  `sn` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `businessKey` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `parent` varchar(36) NOT NULL,
  `parentRole` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `parentSn` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `parentName` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `parentDisplayId` int(11) NOT NULL,
  `parentDisplayName` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `userId` int(11) NOT NULL,
  `userName` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `gameType` int(11) NOT NULL,
  `gameId` int(11) NOT NULL,
  `type` tinyint(4) NOT NULL,
  `originalAmount` double NOT NULL,
  `amount` double NOT NULL,
  `balance` double NOT NULL,
  `sourceIP` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `country` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `province` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `city` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `createdAt` bigint(20) NOT NULL,
  PRIMARY KEY (`sn`),
  KEY `createdAt` (`createdAt` DESC),
  KEY `country` (`country`),
  KEY `parent_createdAt` (`parent`,`createdAt` DESC),
  KEY `type_createdAt` (`type`,`createdAt` DESC),
  KEY `gameType_createdAt` (`gameType`,`createdAt` DESC),
  KEY `gameId_createdAt` (`gameId`,`createdAt` DESC),
  KEY `parentDisplayId_createdAt` (`parentDisplayId`,`createdAt` DESC),
  KEY `parentSn_createdAt` (`parentSn`,`createdAt`),
  KEY `parentRole_createdAt` (`parentRole`,`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `player`;
CREATE TABLE `player` (
  `userId` int(11) NOT NULL,
  `userName` varchar(64) NOT NULL,
  `nickname` varchar(64) NOT NULL,
  `buId` int(11) NOT NULL,
  `parent` varchar(36) NOT NULL,
  `parentName` varchar(64) NOT NULL,
  `parentSn` varchar(20) NOT NULL,
  `msn` varchar(5) NOT NULL,
  `createdAt` bigint(20) NOT NULL,
  PRIMARY KEY (`userId`),
  KEY `buId_createdAt` (`buId`,`createdAt` DESC),
  KEY `parent_createdAt` (`parent`,`createdAt` DESC),
  KEY `parentSn_createdAt` (`parentSn`,`createdAt` DESC),
  KEY `msn_createdAt` (`msn`,`createdAt` DESC)
  KEY `createdAt` (`createdAt` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `role` varchar(5) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `displayId` int(11) NOT NULL,
  `displayName` varchar(20) NOT NULL,
  `username` varchar(36) NOT NULL,
  `sn` varchar(20) NOT NULL,
  `suffix` varchar(20) NOT NULL,
  `uname` varchar(20) NOT NULL,
  `level` int(11) NOT NULL,
  `levelIndex` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `msn` varchar(5) NOT NULL,
  `parent` varchar(36) NOT NULL,
  `parentName` varchar(36) NOT NULL,
  `parentDisplayName` varchar(20) NOT NULL,
  `parentSuffix` varchar(20) NOT NULL,
  `parentRole` varchar(5) NOT NULL,
  `createdAt` bigint(20) NOT NULL,
  PRIMARY KEY (`userId`),
  KEY `levelIndex` (`levelIndex`),
  KEY `createdAt` (`createdAt` DESC),
  KEY `role` (`role`),
  KEY `parent` (`parent`),
  KEY `parentSuffix` (`parentSuffix`),
  KEY `sn` (`sn`),
  KEY `displayId` (`displayId`),
  KEY `level` (`level`),
  KEY `msn` (`msn`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `config`;
CREATE TABLE `config` (
  `type` varchar(20) NOT NULL,
  `createdAt` bigint(20) NOT NULL,
  `flag` tinyint(4) NOT NULL,
  `rangeHour` smallint(6) NOT NULL,
  `playerCreatedAt` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `config` (`type`, `createdAt`, `flag`, `rangeHour`, `playerCreatedAt`) VALUES
('queryTime',	1554048000000,	1,	24,	0);

-- 2019-04-10 06:46:25