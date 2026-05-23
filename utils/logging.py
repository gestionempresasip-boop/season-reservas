"""Logging configuration for Season application."""

import logging
import os
from logging.handlers import RotatingFileHandler
from config.settings import LOG_FILE, LOG_MAX_BYTES, LOG_BACKUP_COUNT, LOG_LEVEL

# ═══════════════════════════════════════════════════════════════════════════
# LOGGING SETUP
# ═══════════════════════════════════════════════════════════════════════════

def setup_logging(app):
    """Configure logging for the application."""

    # Create logs directory if it doesn't exist
    logs_dir = os.path.dirname(LOG_FILE)
    if logs_dir and not os.path.exists(logs_dir):
        os.makedirs(logs_dir)

    # Create rotating file handler
    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=LOG_MAX_BYTES,
        backupCount=LOG_BACKUP_COUNT
    )

    # Set formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(formatter)

    # Set level
    level = getattr(logging, LOG_LEVEL.upper(), logging.INFO)
    file_handler.setLevel(level)

    # Add handler to Flask logger
    app.logger.addHandler(file_handler)
    app.logger.setLevel(level)

    # Disable some noisy loggers
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    logging.getLogger('flask_cors').setLevel(logging.WARNING)

    return app.logger


def get_logger(name):
    """Get a logger instance."""
    return logging.getLogger(name)


# ═══════════════════════════════════════════════════════════════════════════
# LOG FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

def log_request(logger, method, path, status_code):
    """Log API request."""
    logger.info(f'{method} {path} -> {status_code}')

def log_error(logger, error_type, message, details=None):
    """Log error."""
    if details:
        logger.error(f'{error_type}: {message}. Details: {details}')
    else:
        logger.error(f'{error_type}: {message}')

def log_database_error(logger, operation, error):
    """Log database error."""
    logger.error(f'Database error during {operation}: {str(error)}')

def log_validation_error(logger, resource, errors):
    """Log validation error."""
    logger.warning(f'Validation error for {resource}: {errors}')
