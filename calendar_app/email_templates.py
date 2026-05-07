from django.utils.safestring import mark_safe


def _substitute_variables(template: str, **kwargs) -> str:
    """Replace {variable} placeholders with actual values."""
    result = template
    for key, value in kwargs.items():
        result = result.replace("{" + key + "}", str(value))
    return result


def render_vacation_notification_html(
    brand_name: str,
    first_name: str,
    last_name: str,
    technology: str,
    vacation_type: str,
    start_date: str,
    end_date: str,
    custom_template: str = "",
) -> str:
    """Renders a beautiful HTML email for vacation notifications.
    
    If custom_template is provided, uses it with variable substitution.
    Otherwise falls back to the default professional template.
    """
    
    if custom_template:
        return _substitute_variables(
            custom_template,
            brand_name=brand_name,
            first_name=first_name,
            last_name=last_name,
            technology=technology,
            vacation_type=vacation_type,
            start_date=start_date,
            end_date=end_date,
        )
    
    # Default professional template
    
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
<style>
    body {{
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #1f2937;
        margin: 0;
        padding: 0;
    }}
    .container {{
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background-color: #ffffff;
    }}
    .header {{
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        padding: 32px 24px;
        border-radius: 12px 12px 0 0;
        text-align: center;
    }}
    .header h1 {{
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.025em;
    }}
    .content {{
        background: #f8fafc;
        padding: 32px 24px;
        border: 1px solid #e2e8f0;
        border-top: none;
        border-radius: 0 0 12px 12px;
    }}
    .intro {{
        margin-bottom: 24px;
        font-size: 16px;
        color: #4b5563;
    }}
    .details-card {{
        background: white;
        padding: 20px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    }}
    .detail-row {{
        display: flex;
        padding: 12px 0;
        border-bottom: 1px solid #f1f5f9;
    }}
    .detail-row:last-child {{
        border-bottom: none;
    }}
    .label {{
        font-weight: 600;
        width: 140px;
        color: #64748b;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }}
    .value {{
        flex: 1;
        color: #0f172a;
        font-size: 15px;
        font-weight: 500;
    }}
    .badge {{
        display: inline-block;
        padding: 2px 8px;
        border-radius: 9999px;
        background-color: #dbeafe;
        color: #1e40af;
        font-size: 13px;
    }}
    .footer {{
        text-align: center;
        margin-top: 32px;
        color: #94a3b8;
        font-size: 13px;
    }}
    .footer p {{
        margin: 4px 0;
    }}
</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{brand_name}</h1>
        </div>
        <div class="content">
            <p class="intro">Hello,</p>
            <p class="intro">This is to inform you that a consultant has scheduled vacation time.</p>
            
            <div class="details-card">
                <div class="detail-row">
                    <span class="label">Consultant</span>
                    <span class="value">{first_name} {last_name}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Technology</span>
                    <span class="value"><span class="badge">{technology}</span></span>
                </div>
                <div class="detail-row">
                    <span class="label">Type</span>
                    <span class="value">{vacation_type}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Period</span>
                    <span class="value">{start_date} &mdash; {end_date}</span>
                </div>
            </div>
            
            <div class="footer">
                <p>This is an automated notification from {brand_name}.</p>
                <p>&copy; {brand_name} All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>
    """
    return html_content
