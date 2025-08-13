import { Module } from '@nestjs/common';
import { LauncherGateway } from './launcher.gateway';
import { LauncherSessions } from './launcher.sessions';
import { PendingCredsStore } from './pending-creds.store';
import { ConnectionAliases } from './connection-aliases';

@Module({
  providers: [
    LauncherGateway,
    LauncherSessions,
    PendingCredsStore,
    ConnectionAliases,
  ],
  exports: [
    LauncherGateway,
    LauncherSessions,
    PendingCredsStore,
    ConnectionAliases,
  ],
})
export class LauncherWsModule {}
