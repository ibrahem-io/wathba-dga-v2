import React, { useState, useEffect } from 'react';
import { Activity, Users, Clock, AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import { langchainService } from '../services/langchainService';

interface SystemStatusPanelProps {
  language: 'ar' | 'en';
}

export default function SystemStatusPanel({ language }: SystemStatusPanelProps) {
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      try {
        const status = langchainService.getSystemStatus();
        setSystemStatus(status);
      } catch (error) {
        console.error('Failed to get system status:', error);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  if (!systemStatus) return null;

  const getAgentStatusIcon = (status: string) => {
    switch (status) {
      case 'idle':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'busy':
        return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <div className="w-4 h-4 bg-gray-300 rounded-full" />;
    }
  };

  const getAgentStatusText = (status: string) => {
    const statusMap = {
      idle: { ar: 'متاح', en: 'Idle' },
      busy: { ar: 'مشغول', en: 'Busy' },
      error: { ar: 'خطأ', en: 'Error' },
      stopped: { ar: 'متوقف', en: 'Stopped' }
    };
    return statusMap[status as keyof typeof statusMap]?.[language] || status;
  };

  const agentStates = Object.values(systemStatus.agentStates || {});
  const busyAgents = agentStates.filter((agent: any) => agent.status === 'busy').length;
  const errorAgents = agentStates.filter((agent: any) => agent.status === 'error').length;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className={`bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all ${
          busyAgents > 0 ? 'animate-pulse' : ''
        }`}
        title={language === 'ar' ? 'حالة النظام' : 'System Status'}
      >
        <Activity className="w-5 h-5" />
        {busyAgents > 0 && (
          <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {busyAgents}
          </div>
        )}
      </button>

      {/* Status Panel */}
      {isVisible && (
        <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80">
          <div className={`flex items-center justify-between mb-4 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <h3 className={`font-semibold text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              {language === 'ar' ? 'حالة النظام' : 'System Status'}
            </h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          {/* Overall Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <Users className="w-4 h-4 text-blue-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-blue-600">{systemStatus.activeAgents}</div>
              <div className="text-xs text-blue-700">
                {language === 'ar' ? 'نشط' : 'Active'}
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-2 text-center">
              <Clock className="w-4 h-4 text-orange-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-orange-600">{systemStatus.queueLength}</div>
              <div className="text-xs text-orange-700">
                {language === 'ar' ? 'في الانتظار' : 'Queued'}
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-2 text-center">
              <AlertTriangle className="w-4 h-4 text-red-600 mx-auto mb-1" />
              <div className="text-lg font-bold text-red-600">{errorAgents}</div>
              <div className="text-xs text-red-700">
                {language === 'ar' ? 'أخطاء' : 'Errors'}
              </div>
            </div>
          </div>

          {/* Agent Details */}
          <div className="space-y-2">
            <h4 className={`text-sm font-medium text-gray-700 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              {language === 'ar' ? 'الوكلاء الذكيين:' : 'Smart Agents:'}
            </h4>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {agentStates.map((agent: any) => (
                <div
                  key={agent.id}
                  className={`flex items-center justify-between p-2 bg-gray-50 rounded text-xs ${
                    language === 'ar' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div className={`flex items-center space-x-2 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
                    {getAgentStatusIcon(agent.status)}
                    <span className="font-medium text-gray-700">
                      {agent.id.split('-')[0]}
                    </span>
                  </div>
                  <span className={`text-gray-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                    {getAgentStatusText(agent.status)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Indicator */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className={`flex items-center justify-between text-xs ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
              <span className="text-gray-600">
                {language === 'ar' ? 'أداء النظام:' : 'System Performance:'}
              </span>
              <div className={`flex items-center space-x-1 ${language === 'ar' ? 'space-x-reverse' : ''}`}>
                <div className={`w-2 h-2 rounded-full ${
                  errorAgents > 0 ? 'bg-red-500' :
                  busyAgents > 2 ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}></div>
                <span className="text-gray-700">
                  {errorAgents > 0 ? (language === 'ar' ? 'مشاكل' : 'Issues') :
                   busyAgents > 2 ? (language === 'ar' ? 'مشغول' : 'Busy') :
                   (language === 'ar' ? 'ممتاز' : 'Excellent')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}