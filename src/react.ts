import { Client } from '@verdant-web/store';
import { Drawing } from './schema.js';
import { useEffect, useState } from 'react';
import {
  createTLStore,
  TLAnyShapeUtilConstructor,
  defaultShapeUtils,
  TLStoreWithStatus,
  TLInstancePresence,
  setUserPreferences,
  computed,
  getUserPreferences,
  InstancePresenceRecordType,
  defaultUserPreferences,
  createPresenceStateDerivation,
  react,
} from '@tldraw/tldraw';

export interface TldrawPresence {
  tlDraw?: TLInstancePresence;
}

export function useVerdantStore({
  client,
  drawing,
  shapeUtils = [],
}: {
  client: Pick<Client<TldrawPresence>, 'subscribe' | 'sync'>;
  drawing: Drawing | null;
  shapeUtils?: TLAnyShapeUtilConstructor[];
}) {
  const [store] = useState(() => {
    return createTLStore({
      shapeUtils: [...defaultShapeUtils, ...shapeUtils],
    });
  });

  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: 'synced-local',
    store,
  });

  // sync the states
  useEffect(() => {
    if (!drawing) return;

    store.loadSnapshot(drawing.getSnapshot());

    const unsubs: (() => void)[] = [];

    unsubs.push(
      store.listen(
        function syncToVerdant() {
          const storeSnapshot = store.getSnapshot('document');
          // TODO: fix incoming in verdant for this typing.
          drawing.get('store').update(storeSnapshot.store as any, {
            merge: false,
          });
          drawing.get('schema').update(storeSnapshot.schema as any, {
            merge: false,
          });
        },
        // only this user's changes
        { source: 'user', scope: 'document' },
      ),
    );

    unsubs.push(
      drawing.subscribe('changeDeep', function syncToTLDraw(_, { isLocal }) {
        // ignore local changes; these were sent through tldraw already and
        // applied to this entity; we do not need to loop them back to tldraw.
        // we only care about remote changes, which we need to apply in tldraw.
        if (isLocal) return;

        store.mergeRemoteChanges(() => {
          store.loadSnapshot(drawing.getSnapshot() as any);
        });
      }),
    );

    /**
     * Presence
     */

    // subscribe to Verdant presence changes
    unsubs.push(
      client.sync.presence.subscribe('selfChanged', (me) => {
        const tldrawPresence = me.presence.tlDraw;
        if (!tldrawPresence) return;

        store.mergeRemoteChanges(() => {
          store.put([tldrawPresence]);
        });
      }),
    );
    unsubs.push(
      client.sync.presence.subscribe('peersChanged', (peers) => {
        store.mergeRemoteChanges(() => {
          store.put(
            Object.values(peers)
              .map((p) => p.presence.tlDraw)
              .filter(Boolean),
          );
        });
      }),
    );
    unsubs.push(
      client.sync.presence.subscribe('peerLeft', (_userId, lastKnown) => {
        const tldrawId = lastKnown.presence.tlDraw?.id;
        if (!tldrawId) return;
        store.mergeRemoteChanges(() => {
          store.remove([tldrawId]);
        });
      }),
    );

    // setup presence in Tldraw

    // use replicaId, not profile ID, so multiple replicas under the same
    // profile have different cursors
    const awarenessId = client.sync.presence.self.replicaId;
    setUserPreferences({ id: awarenessId });

    const userPreferences = computed<{
      id: string;
      color: string;
      name: string;
    }>('userPreferences', () => {
      const user = getUserPreferences();
      return {
        id: user.id,
        color: user.color ?? defaultUserPreferences.color,
        name: user.name ?? defaultUserPreferences.name,
      };
    });

    // Create the instance presence derivation
    const presenceId = InstancePresenceRecordType.createId(awarenessId);
    const presenceDerivation = createPresenceStateDerivation(
      userPreferences,
      presenceId,
    )(store);

    // Set our initial presence from the derivation's current value
    const initialPresence = presenceDerivation.get();
    client.sync.presence.update({ tlDraw: initialPresence ?? undefined });

    // When the derivation change, sync presence to to yjs awareness
    unsubs.push(
      react('when presence changes', () => {
        const presence = presenceDerivation.get();
        client.sync.presence.update({ tlDraw: presence ?? undefined });
      }),
    );

    // track online sync status
    unsubs.push(
      client.sync.subscribe(
        'onlineChange',
        function onVerdantOnlineChange(isOnline) {
          if (isOnline) {
            setStoreWithStatus({
              store,
              status: 'synced-remote',
              connectionStatus: 'online',
            });
          } else {
            setStoreWithStatus({
              store,
              status: 'synced-remote',
              connectionStatus: 'offline',
            });
          }
        },
      ),
    );

    return () => {
      unsubs.forEach((fn) => fn());
      unsubs.length = 0;
    };
  }, [drawing, store, client]);

  return storeWithStatus;
}
