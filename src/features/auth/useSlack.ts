// F-03 for real (decision 0017): connecting a live Slack workspace. Slack's
// own permission page grants Rooted's bot read access to public channels; the
// PM then checks which channels Rooted may read. New channels start unchecked.
import { useCallback, useEffect, useState } from 'react';
import { useAi } from '../../agent/AiContext';
import { errorCode, type AiErrorCode, type SlackStatus } from '../../agent/client';
import { useStore } from '../../store/store';
import type { Source } from '../../types';

export function liveSlack(sources: Source[]): Source | undefined {
  return sources.find((s) => s.type === 'slack' && !s.sample);
}

export function useLiveSlack() {
  const { state, dispatch } = useStore();
  const ai = useAi();
  const source = liveSlack(state.sources);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AiErrorCode | null>(null);
  const [revoked, setRevoked] = useState(false);

  const apply = useCallback(
    (status: SlackStatus) => {
      if (!source) return;
      setRevoked(!!status.revoked);
      if (!status.connected) {
        if (source.connected) dispatch({ type: 'updateSource', sourceId: source.id, patch: { connected: false, connectedAt: undefined } });
        return;
      }
      const allowed = new Map(source.channels.map((c) => [c.id, c.allowed]));
      dispatch({
        type: 'updateSource',
        sourceId: source.id,
        patch: {
          connected: true,
          name: status.teamName ? `${status.teamName} Slack` : source.name,
          connectedAt: status.connectedAt ? new Date(status.connectedAt * 1000).toISOString() : source.connectedAt,
          channels: (status.channels ?? []).map((c) => ({ ...c, allowed: allowed.get(c.id) ?? false })),
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source?.id, source?.connected, source?.channels, dispatch],
  );

  const refresh = useCallback(async () => {
    if (!ai || !source) return;
    try {
      apply(await ai.slackStatus());
      setError(null);
    } catch (e) {
      setError(errorCode(e));
    }
  }, [ai, source, apply]);

  // Check once on arrival, e.g. coming back from Slack's permission page.
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai, source?.id]);

  async function connect() {
    if (!ai) {
      setError('not_configured');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      window.location.assign(await ai.slackInstallUrl());
    } catch (e) {
      setError(errorCode(e));
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!source) return;
    setBusy(true);
    try {
      if (ai) await ai.slackDisconnect();
    } catch {
      // Rooted forgets the connection either way; Slack drops the bot when its token is revoked.
    } finally {
      dispatch({ type: 'updateSource', sourceId: source.id, patch: { connected: false, connectedAt: undefined } });
      setBusy(false);
    }
  }

  return { source, busy, error, revoked, connect, disconnect, refresh };
}

// What Slack's permission page sent back, as a message for the PM.
export const SLACK_RETURN_MESSAGE: Record<string, string> = {
  connected: 'Slack is connected. Check the channels Rooted may read.',
  cancelled: 'Slack wasn’t connected: the permission page was cancelled. You can try again any time.',
  expired: 'That Slack connection took too long or came from another session. Start it again here.',
  error: 'Slack couldn’t finish connecting. Try again, and ask a Slack admin if your workspace needs approval for new apps.',
};
