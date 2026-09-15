"""
provide some func tools for analysis services moduls
"""

import uuid

def get_job_id() -> str:
    """
    Generate a unique job ID using UUID4.

    Returns
    -------
    str
        A unique job ID.
    """
    return str(uuid.uuid4())