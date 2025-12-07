/**
 * MetricCard Component
 *
 * PURPOSE: Display a single metric with value, trend, and optional chart
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import './AdminStyles.css';

const MetricCard = ({
  title,
  value,
  change,
  changePercent,
  icon: Icon,
  format = 'number',
  subtitle,
  loading = false,
  trend = 'neutral', // 'up', 'down', 'neutral'
  size = 'normal', // 'small', 'normal', 'large'
  color = 'blue' // 'blue', 'green', 'yellow', 'red', 'purple'
}) => {
  // Format value based on type
  const formatValue = (val) => {
    if (val === null || val === undefined) return '-';

    switch (format) {
      case 'number':
        return typeof val === 'number' ? val.toLocaleString() : val;
      case 'currency':
        return `$${typeof val === 'number' ? val.toFixed(2) : val}`;
      case 'percent':
        return `${typeof val === 'number' ? val.toFixed(1) : val}%`;
      case 'bytes':
        return formatBytes(val);
      case 'duration':
        return formatDuration(val);
      default:
        return val;
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  // Determine trend based on change
  const determinedTrend = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  const displayTrend = trend !== 'neutral' ? trend : determinedTrend;

  const getTrendIcon = () => {
    switch (displayTrend) {
      case 'up':
        return <TrendingUp size={16} />;
      case 'down':
        return <TrendingDown size={16} />;
      default:
        return <Minus size={16} />;
    }
  };

  const getTrendClass = () => {
    if (displayTrend === 'up') return 'trend-up';
    if (displayTrend === 'down') return 'trend-down';
    return 'trend-neutral';
  };

  const getColorClass = () => {
    return `metric-card-${color}`;
  };

  if (loading) {
    return (
      <div className={`metric-card metric-card-${size} ${getColorClass()} loading`}>
        <div className="metric-card-skeleton" />
      </div>
    );
  }

  return (
    <div className={`metric-card metric-card-${size} ${getColorClass()}`}>
      <div className="metric-card-header">
        {Icon && (
          <div className="metric-card-icon">
            <Icon size={20} />
          </div>
        )}
        <span className="metric-card-title">{title}</span>
      </div>

      <div className="metric-card-value">
        {formatValue(value)}
      </div>

      {(change !== undefined || changePercent !== undefined || subtitle) && (
        <div className="metric-card-footer">
          {changePercent !== undefined && (
            <span className={`metric-card-change ${getTrendClass()}`}>
              {getTrendIcon()}
              <span>{changePercent > 0 ? '+' : ''}{changePercent}%</span>
            </span>
          )}
          {subtitle && (
            <span className="metric-card-subtitle">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default MetricCard;
