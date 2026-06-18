import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { API_BASE_URL } from '../../config';

const CHECK_INTERVAL_MS = 60 * 1000;

const getVersionKey = (version) => {
  if (!version) return null;
  return [version.service, version.commit || version.version, version.build_time].filter(Boolean).join(':');
};

const fetchJsonNoCache = async (url) => {
  const separator = url.includes('?') ? '&' : '?';
  const response = await fetch(`${url}${separator}t=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  });

  if (!response.ok) {
    throw new Error(`Version check failed: ${response.status}`);
  }

  return response.json();
};

const VersionUpdatePrompt = () => {
  const initialWebVersion = useRef(null);
  const initialApiVersion = useRef(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [dismissedKey, setDismissedKey] = useState(null);

  useEffect(() => {
    let mounted = true;

    const checkVersions = async () => {
      try {
        const [webVersion, apiVersion] = await Promise.all([
          fetchJsonNoCache('/version.json'),
          fetchJsonNoCache(`${API_BASE_URL}/version`),
        ]);

        const webKey = getVersionKey(webVersion);
        const apiKey = getVersionKey(apiVersion);

        if (!initialWebVersion.current) {
          initialWebVersion.current = webKey;
        }
        if (!initialApiVersion.current) {
          initialApiVersion.current = apiKey;
        }

        const changedServices = [];
        if (initialWebVersion.current && webKey && webKey !== initialWebVersion.current) {
          changedServices.push('web');
        }
        if (initialApiVersion.current && apiKey && apiKey !== initialApiVersion.current) {
          changedServices.push('api');
        }

        const updateKey = [webKey, apiKey].filter(Boolean).join('|');
        if (mounted && changedServices.length > 0 && dismissedKey !== updateKey) {
          setUpdateInfo({ changedServices, updateKey });
        }
      } catch (error) {
        // A checagem nao deve atrapalhar o uso normal do app.
      }
    };

    checkVersions();
    const interval = window.setInterval(checkVersions, CHECK_INTERVAL_MS);
    const handleVisibility = () => {
      if (!document.hidden) {
        checkVersions();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [dismissedKey]);

  const handleRefresh = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('refresh', Date.now().toString());
    window.location.replace(url.toString());
  };

  if (!updateInfo) {
    return null;
  }

  return (
    <div className="version-update" role="dialog" aria-live="polite" aria-label="Nova versao disponivel">
      <div>
        <p className="m-0 text-sm font-extrabold text-slate-950">Nova versao disponivel</p>
        <p className="m-0 mt-1 text-sm text-slate-500">
          Atualizacao detectada em {updateInfo.changedServices.includes('api') ? 'API' : ''}
          {updateInfo.changedServices.length === 2 ? ' e ' : ''}
          {updateInfo.changedServices.includes('web') ? 'Web' : ''}. Atualize para carregar a versao mais recente.
        </p>
      </div>
      <div className="version-update__actions">
        <button className="button-secondary" type="button" onClick={() => {
          setDismissedKey(updateInfo.updateKey);
          setUpdateInfo(null);
        }}>
          <X size={16} />
          Depois
        </button>
        <button className="button-primary" type="button" onClick={handleRefresh}>
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>
    </div>
  );
};

export default VersionUpdatePrompt;
