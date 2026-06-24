interface ErrorReport {
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  timestamp: number;
  url: string;
  userAgent: string;
}

const MAX_QUEUE_SIZE = 50;

export function reportError(error: Error, context?: Record<string, unknown>) {
  console.error(error);
  const report: ErrorReport = {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: Date.now(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  };
  const queue = JSON.parse(localStorage.getItem('error_queue') || '[]');
  queue.push(report);
  if (queue.length > MAX_QUEUE_SIZE) queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  localStorage.setItem('error_queue', JSON.stringify(queue));
}

export function getErrorQueue(): ErrorReport[] {
  return JSON.parse(localStorage.getItem('error_queue') || '[]');
}

export function clearErrorQueue() {
  localStorage.removeItem('error_queue');
}
