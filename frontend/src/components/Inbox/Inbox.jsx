// frontend/src/components/Inbox/Inbox.jsx
import React, { useEffect, useState } from 'react';
import { useConversationStore } from '../../store';
import ConversationList          from './ConversationList';
import ChatWindow                from '../Chat/ChatWindow';
import WhatsappBusinessPanel     from './WhatsappBusinessPanel';
import ConversationInfoPanel     from './ConversationInfoPanel';
import { PanelRight, Briefcase } from 'lucide-react';

export default function Inbox() {
  const { fetchConversations, activeConversation } = useConversationStore();
  const [showList, setShowList] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [inboxTab, setInboxTab] = useState('general');

  useEffect(() => { fetchConversations(); }, []);

  useEffect(() => {
    if (activeConversation && window.innerWidth < 768) setShowList(false);
  }, [activeConversation]);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* TABS */}
      <div className="flex border-b border-[#d1d7db] dark:border-[#2a3942] bg-white dark:bg-[#202c33] flex-shrink-0">

        {/* Bandeja general */}
        <button
          onClick={() => setInboxTab('general')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all border-b-2
            ${inboxTab === 'general'
              ? 'text-[#00a884] border-[#00a884] bg-[#f0fdf4] dark:bg-[#00a884]/10'
              : 'text-[#54656f] dark:text-[#8696a0] border-transparent hover:text-[#111b21] dark:hover:text-[#e9edef] hover:bg-[#f5f6f6] dark:hover:bg-white/5'}`}
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/>
            <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"/>
          </svg>
          Bandeja general
        </button>

        {/* WhatsApp Business (Baileys) */}
        <button
          onClick={() => setInboxTab('business')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all border-b-2
            ${inboxTab === 'business'
              ? 'text-blue-600 dark:text-blue-400 border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-500/10'
              : 'text-slate-500 dark:text-[#8696a0] border-transparent hover:text-slate-700 dark:hover:text-[#e9edef] hover:bg-slate-50 dark:hover:bg-white/5'}`}
        >
          <Briefcase size={15} />
          WhatsApp Personal/Business
        </button>

        {/* Toggle panel info — solo en general */}
        {inboxTab === 'general' && activeConversation && (
          <div className="ml-auto flex items-center pr-3">
            <button
              onClick={() => setShowInfo(!showInfo)}
              title={showInfo ? 'Ocultar panel' : 'Ver informacion'}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium
                ${showInfo
                  ? 'bg-[#f0fdf4] dark:bg-[#00a884]/10 text-[#00a884] border border-[#00a884]/30'
                  : 'text-[#54656f] dark:text-[#8696a0] hover:bg-[#f5f6f6] dark:hover:bg-white/5 border border-transparent'}`}
            >
              <PanelRight size={14} />
              Info
            </button>
          </div>
        )}
      </div>

      {/* CONTENIDO */}
      {inboxTab === 'general' ? (
        <div className="flex flex-1 overflow-hidden">

          {/* Lista de conversaciones */}
          <div className={`
            h-full flex-shrink-0 bg-white dark:bg-[#111b21] border-r border-[#d1d7db] dark:border-[#2a3942] flex flex-col
            transition-all duration-300
            md:w-80 md:flex
            ${showList ? 'w-full flex' : 'w-0 hidden md:w-80 md:flex'}
          `}>
            <ConversationList
              onSelectConversation={() => {
                if (window.innerWidth < 768) setShowList(false);
              }}
            />
          </div>

          {/* Chat */}
          <div className={`
            flex-1 flex flex-col h-full bg-[#f8f9fa] dark:bg-[#0b141a] overflow-hidden
            ${showList ? 'hidden md:flex' : 'flex'}
          `}>
            {activeConversation && (
              <button
                onClick={() => setShowList(true)}
                className="md:hidden flex items-center gap-2 px-4 py-3 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#d1d7db] dark:border-[#2a3942]
                           text-sm font-medium text-[#00a884] hover:bg-[#f0fdf4] dark:hover:bg-white/5 transition-colors"
              >
                <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
                  <path fillRule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clipRule="evenodd" />
                </svg>
                Volver a la bandeja
              </button>
            )}
            <ChatWindow />
          </div>

          {/* Panel de informacion lateral */}
          {activeConversation && showInfo && (
            <div className="hidden lg:flex flex-col h-full w-72 xl:w-80 flex-shrink-0 border-l border-[#d1d7db] dark:border-[#2a3942] bg-white dark:bg-[#111b21] overflow-hidden">
              <ConversationInfoPanel conversation={activeConversation} />
            </div>
          )}
        </div>

      ) : (
        <div className="flex-1 overflow-hidden">
          <WhatsappBusinessPanel />
        </div>
      )}
    </div>
  );
}