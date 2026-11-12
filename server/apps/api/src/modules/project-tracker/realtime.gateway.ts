import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { TokenVerifier, type AuthUser } from '@platform/authz';
import { TOKEN_VERIFIER } from '@platform/authz';
import { PT_EVENTS, ProjectTrackerService } from './project-tracker.service';

interface ClientState {
  user?: AuthUser;
  topics: Set<string>;
}

@Injectable()
@WebSocketGateway({ path: '/ws', cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect, OnApplicationShutdown {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  private readonly clients = new Map<WebSocket, ClientState>();

  constructor(
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    private readonly tracker: ProjectTrackerService,
  ) {}

  async handleConnection(client: WebSocket): Promise<void> {
    this.clients.set(client, { topics: new Set() });
    client.on('message', (raw) => void this.onMessage(client, raw.toString()));
  }

  handleDisconnect(client: WebSocket): void {
    this.clients.delete(client);
  }

  onApplicationShutdown(): void {
    for (const client of this.clients.keys()) client.close();
    this.clients.clear();
  }

  private async onMessage(client: WebSocket, raw: string): Promise<void> {
    let message: { type?: string; token?: string; topic?: string; topics?: string[] };
    try {
      message = JSON.parse(raw) as typeof message;
    } catch {
      return this.send(client, { type: 'error', message: 'invalid json' });
    }

    if (message.type === 'auth' && message.token) {
      try {
        const user = await this.verifier.verify(message.token);
        const state = this.clients.get(client);
        if (state) state.user = user;
        this.send(client, { type: 'ready', userId: user.id });
      } catch {
        this.send(client, { type: 'error', message: 'invalid token' });
        client.close();
      }
      return;
    }

    if (message.type === 'subscribe') {
      const state = this.clients.get(client);
      if (!state?.user) return this.send(client, { type: 'error', message: 'not authenticated' });
      const topics = message.topics ?? (message.topic ? [message.topic] : []);
      const accepted: string[] = [];
      for (const topic of topics) {
        if (!(await this.canAccess(state.user, topic))) {
          this.send(client, { type: 'error', message: `forbidden topic ${topic}` });
          continue;
        }
        state.topics.add(topic);
        accepted.push(topic);
      }
      this.send(client, { type: 'subscribed', topics: accepted });
      return;
    }

    if (message.type === 'unsubscribe') {
      const state = this.clients.get(client);
      if (!state) return;
      const topics = message.topics ?? (message.topic ? [message.topic] : []);
      for (const topic of topics) state.topics.delete(topic);
      this.send(client, { type: 'unsubscribed', topics });
      return;
    }

    if (message.type === 'ping') this.send(client, { type: 'pong' });
  }

  private async canAccess(user: AuthUser, topic: string): Promise<boolean> {
    if (topic === `notifications:${user.id}`) return true;
    try {
      if (topic.startsWith('comments:')) {
        await this.tracker.assertTaskRole(user, topic.slice('comments:'.length), 'member');
        return true;
      }
      if (topic.startsWith('reactions:')) {
        await this.tracker.assertCommentRole(user, topic.slice('reactions:'.length), 'member');
        return true;
      }
      if (topic.startsWith('project:')) {
        await this.tracker.assertProjectRole(user, topic.slice('project:'.length), 'member');
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  @OnEvent(PT_EVENTS.commentCreated)
  onCommentCreated(payload: { taskId: string; comment: unknown }): void {
    this.broadcast(`comments:${payload.taskId}`, { type: 'comment.created', taskId: payload.taskId, comment: payload.comment });
  }

  @OnEvent(PT_EVENTS.commentDeleted)
  onCommentDeleted(payload: { taskId: string; commentId: string }): void {
    this.broadcast(`comments:${payload.taskId}`, { type: 'comment.deleted', taskId: payload.taskId, commentId: payload.commentId });
  }

  @OnEvent(PT_EVENTS.reactionAdded)
  onReactionAdded(payload: { commentId: string; reaction: unknown }): void {
    this.broadcast(`reactions:${payload.commentId}`, { type: 'reaction.added', commentId: payload.commentId, reaction: payload.reaction });
  }

  @OnEvent(PT_EVENTS.reactionRemoved)
  onReactionRemoved(payload: { commentId: string; emoji: string; userId: string }): void {
    this.broadcast(`reactions:${payload.commentId}`, {
      type: 'reaction.removed',
      commentId: payload.commentId,
      emoji: payload.emoji,
      userId: payload.userId,
    });
  }

  @OnEvent(PT_EVENTS.notificationCreated)
  onNotificationCreated(payload: { notification: { userId: string } & Record<string, unknown> }): void {
    this.broadcast(`notifications:${payload.notification.userId}`, {
      type: 'notification.created',
      notification: payload.notification,
    });
  }

  @OnEvent(PT_EVENTS.taskChanged)
  onTaskChanged(payload: { projectId: string; taskId: string; action: string }): void {
    this.broadcast(`project:${payload.projectId}`, { type: 'task.changed', ...payload });
  }

  @SubscribeMessage('ping')
  ping(@ConnectedSocket() client: WebSocket, @MessageBody() body: unknown): void {
    void body;
    this.send(client, { type: 'pong' });
  }

  private broadcast(topic: string, payload: Record<string, unknown>): void {
    const data = JSON.stringify({ topic, ...payload });
    for (const [client, state] of this.clients) {
      if (state.topics.has(topic) && client.readyState === WebSocket.OPEN) client.send(data);
    }
  }

  private send(client: WebSocket, payload: Record<string, unknown>): void {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(payload));
  }
}
