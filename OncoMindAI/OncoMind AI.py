import gradio as gr
import google.generativeai as genai
import os
from typing import Dict, List, Tuple, Any
import random
import json
import pandas as pd
from dotenv import load_dotenv

# --- 1. Configuration and Setup ---

# Load environment variables from .env file
load_dotenv()

# Configure Gemini API
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    # In a real app, you'd want a more graceful way to handle this
    # For the hackathon, this is fine.
    print("WARNING: GEMINI_API_KEY not found. App will run, but AI analysis will fail.")
    # raise ValueError("GEMINI_API_KEY not found in environment variables")
else:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-2.5-flash')

# Define possible symptoms (cleaned list)
SYMPTOMS = [
    "Unexplained weight loss",
    "Persistent fatigue",
    "Lumps or thickening in body",
    "Persistent cough or hoarseness",
    "Difficulty swallowing",
    "Unexplained bleeding or bruising",
    "Changes in bowel or bladder habits",
    "Persistent indigestion or discomfort",
    "Obvious change in a wart or mole",
    "Unusual bleeding or discharge",
    "Thickening or lump in the breast or elsewhere"
]

# Define risk levels and their descriptions
RISK_LEVELS = {
    "LOW": "Your risk of cancer appears to be low based on the symptoms provided.",
    "MODERATE": "You have some symptoms that may warrant further medical attention.",
    "HIGH": "You have several symptoms that could indicate a higher risk of cancer. Please consult a healthcare professional immediately."
}

# --- 2. Mock Database ---
# This simulates a real Firebase/Firestore database.
# In a real app, this would be replaced with actual database calls.
MOCK_DATABASE = {
    "cases": {},
    "case_id_counter": 1000,
}

# --- 3. The Agentic AI Class ---

class CancerRiskAgent:
    def __init__(self, api_configured: bool):
        self.api_configured = api_configured

    def triage_symptoms_agentic(self, symptoms: List[str]) -> Dict[str, Any]:
        """
        Analyzes symptoms and returns a structured "action" for the system to take.
        This is the core of the agentic, human-in-the-loop workflow.
        """
        
        # --- AI Prompting (with Safety Guardrails) ---
        prompt = f"""
        You are "OncoMind AI," an expert medical triage agent. Your task is to analyze a user's self-reported symptoms and decide on an action.

        **CRITICAL RULES & GUARDRAILS:**
        1.  **DO NOT DIAGNOSE:** You must not, under any circumstances, diagnose a specific condition. You only assess risk.
        2.  **REINFORCE DISCLAIMER:** All recommendations *must* end with a strong suggestion to consult a healthcare professional.
        3.  **BE OBJECTIVE:** Do not use "I" or "we." Stick to impersonal, factual information.
        4.  **STICK TO THE FACTS:** Base your analysis *only* on the provided symptoms and general medical knowledge.
        5.  **YOUR ACTION:** Based on the risk, you must decide if this case can be closed (PROVIDE_INFO_ONLY) or if it *must* be seen by a human doctor (FLAG_FOR_REVIEW).
            -   **LOW Risk** -> PROVIDE_INFO_ONLY
            -   **MODERATE or HIGH Risk** -> FLAG_FOR_REVIEW

        **USER-REPORTED SYMPTOMS:**
        {', '.join(symptoms) if symptoms else 'no symptoms'}

        **REQUIRED OUTPUT FORMAT (Strict JSON):**
        You must return *only* a valid JSON object in this exact format:
        {{
            "action": "PROVIDE_INFO_ONLY" | "FLAG_FOR_REVIEW",
            "risk_level": "LOW" | "MODERATE" | "HIGH",
            "analysis": "Your objective analysis of the symptoms.",
            "recommendations": "Your bulleted list of next steps."
        }}
        """
        
        # --- API Call & Error Handling ---
        if not self.api_configured:
            print("AI API is not configured. Returning a mock high-risk response for testing.")
            return json.loads("""
            {
                "action": "FLAG_FOR_REVIEW",
                "risk_level": "HIGH",
                "analysis": "Mock Analysis: This is a high-risk mock response because the AI API key is not set.",
                "recommendations": "- This is a test recommendation.\\n- Please configure the API key."
            }
            """)

        try:
            response = model.generate_content(prompt)
            # Clean the response text to get only the JSON
            json_text = response.text.strip().replace("```json", "").replace("```", "")
            return json.loads(json_text)
            
        except Exception as e:
            print(f"Error generating or parsing AI response: {str(e)}")
            # Fallback to a safe, high-priority response
            return {
                "action": "FLAG_FOR_REVIEW",
                "risk_level": "MODERATE",
                "analysis": f"An error occurred during AI analysis ({str(e)}).",
                "recommendations": "- Please consult with a healthcare professional for a proper assessment."
            }

# --- 4. Database Helper Functions ---
# These functions interact with our MOCK_DATABASE.
# In a real app, these would be `firebase.firestore()...` calls.

def create_case_in_db(symptoms: List[str], ai_response: Dict[str, Any]) -> int:
    """Saves a new case to the mock database."""
    MOCK_DATABASE["case_id_counter"] += 1
    case_id = MOCK_DATABASE["case_id_counter"]
    
    new_case = {
        "case_id": case_id,
        "status": "pending_human_review",
        "submitted_symptoms": symptoms,
        "ai_risk_level": ai_response["risk_level"],
        "ai_analysis": ai_response["analysis"],
        "ai_recommendations": ai_response["recommendations"],
        "doctor_notes": "",
        "final_decision": ""
    }
    MOCK_DATABASE["cases"][str(case_id)] = new_case
    print(f"Case {case_id} created and flagged for review.")
    return case_id

def get_pending_cases_from_db() -> pd.DataFrame:
    """Gets all cases for the doctor's dashboard and returns a pandas DataFrame."""
    cases = MOCK_DATABASE["cases"].values()
    pending = [case for case in cases if case["status"] == "pending_human_review"]
    
    # Create a list of dictionaries with the data
    data = []
    for case in pending:
        data.append({
            "Case ID": case["case_id"],
            "Risk": case["ai_risk_level"],
            "Symptoms": ", ".join(case["submitted_symptoms"]),
            "AI Analysis": case["ai_analysis"]
        })
    
    # Convert to DataFrame
    if not data:  # If no pending cases, return empty DataFrame with correct columns
        return pd.DataFrame(columns=["Case ID", "Risk", "Symptoms", "AI Analysis"])
    return pd.DataFrame(data)

def get_case_status_from_db(case_id: str) -> str:
    """Checks the status of a case for the patient and returns a formatted Markdown string."""
    case = MOCK_DATABASE["cases"].get(str(case_id))
    if not case:
        return "## ❌ Case Not Found\n\nPlease check the Case ID and try again."
    
    if case["status"] == "pending_human_review":
        return f"""## 📋 Case Status: Pending Review

**Status:** ⏳ In Queue

A medical professional has not reviewed your case yet. Please check back later.

### AI Preliminary Analysis
{case['ai_analysis']}

*Thank you for your patience.*
"""
    elif case["status"] == "review_complete":
        return f"""## 📋 Case Status: Reviewed

**Status:** ✅ Review Complete

### Medical Professional's Assessment
**Decision:** {case['final_decision']}

**Doctor's Notes:**  
{case['doctor_notes']}

---
### Original AI Analysis
{case['ai_analysis']}
"""
    return "## ❓ Unknown Status\n\nThe status of this case could not be determined. Please contact support."

def complete_case_review_in_db(case_id: str, final_decision: str, doctor_notes: str) -> str:
    """Allows the doctor to complete their review."""
    case = MOCK_DATABASE["cases"].get(str(case_id))
    if not case:
        return f"Error: Case {case_id} not found."
    
    case["status"] = "review_complete"
    case["final_decision"] = final_decision
    case["doctor_notes"] = doctor_notes
    
    print(f"Case {case_id} review complete.")
    return f"Success: Case {case_id} has been reviewed and closed."


# --- 5. Gradio Interface (with HITL) ---

# Create the agent
agent = CancerRiskAgent(api_configured=bool(GEMINI_API_KEY))

def create_interface():
    """Create the Gradio interface with Patient and Doctor tabs."""
    
    # Custom CSS (same as your v3)
    custom_css = """
    .gradio-container { ... } /* Your full CSS is very long, so I'll snippet it */
    .gradio-container {
        max-width: 1100px !important; margin: 0 auto !important; font-family: 'Inter', sans-serif;
        background-color: #0f172a; color: #e2e8f0; min-height: 100vh;
    }
    label, .gr-checkbox-label, .gr-markdown, .gr-radio-label, .gr-tabs, .gr-tab-item { color: #e2e8f0 !important; }
    .gr-checkbox { margin: 6px 0; background: #1e293b; padding: 10px 15px; border-radius: 8px; border: 1px solid #334155; }
    .gr-tabs { background: #1e293b; border-radius: 12px; padding: 8px; margin: 20px 0; border: 1px solid #334155; }
    .gr-tab-item { padding: 10px 24px; border-radius: 8px; font-weight: 500; color: #94a3b8 !important; }
    .gr-tab-item.selected { background: #3b82f6; color: white !important; }
    .header { text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #1e40af, #1e3a8a); color: white; border-radius: 14px; margin: 0 0 30px; }
    .header h1 { margin: 0; font-size: 32px; font-weight: 700; }
    .header p { margin: 0; opacity: 0.9; font-size: 17px; }
    .symptoms-container { background: #1e293b; padding: 24px; border-radius: 14px; border: 1px solid #334155; }
    .symptoms-column { background: #1e293b; padding: 16px; border-radius: 10px; margin: 8px 0; border: 1px solid #334155; }
    .risk-card { border-left: 4px solid #3b82f6; padding: 20px; margin: 16px 0; background: #1e293b; border-radius: 10px; border: 1px solid #334155; }
    .risk-card h2 { margin: 0 0 12px 0; font-size: 22px; }
    .risk-high { border-left-color: #ef4444 !important; }
    .risk-high h2 { color: #f87171 !important; }
    .risk-moderate { border-left-color: #f59e0b !important; }
    .risk-moderate h2 { color: #fbbf24 !important; }
    .risk-low { border-left-color: #10b981 !important; }
    .risk-low h2 { color: #34d399 !important; }
    .tab-content { background: #1e293b; padding: 24px; border-radius: 12px; margin-top: 12px; border: 1px solid #334155; }
    .tab-content h2 { font-size: 20px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #334155; }
    .tab-content li:before { content: '•'; color: #60a5fa; font-weight: bold; display: inline-block; width: 1em; margin-left: -1em; }
    .gr-button-primary { background: #3b82f6 !important; color: white !important; }
    .gr-button-secondary { background: #334155 !important; color: #e2e8f0 !important; }
    """

    with gr.Blocks(title="OncoMind AI (HITL)", css=custom_css, theme=gr.themes.Soft(primary_hue="blue")) as demo:
        
        # Header Section
        with gr.Row(elem_classes=["header"]):
            gr.Markdown("""
            <h1>🩺 OncoMind AI | Human-in-the-Loop Agent</h1>
            <p>This application demonstrates a full AI-agent workflow with Human-in-the-Loop (HITL) review.</p>
            """)

        with gr.Tabs():
            # --- TAB 1: PATIENT PORTAL ---
            with gr.TabItem("🧑‍⚕️ Patient Portal", elem_classes=["tab-content"]):
                with gr.Row():
                    # Left Column - Symptoms
                    with gr.Column(scale=2):
                        with gr.Row(elem_classes=["symptoms-container"]):
                            with gr.Column():
                                gr.Markdown("### 🤒 Select Your Symptoms")
                                inputs = []
                                with gr.Row():
                                    col1 = gr.Column(elem_classes=["symptoms-column"])
                                    col2 = gr.Column(elem_classes=["symptoms-column"])
                                    for i, symptom in enumerate(SYMPTOMS):
                                        col = col1 if i % 2 == 0 else col2
                                        with col:
                                            inputs.append(gr.Checkbox(label=symptom, value=False, interactive=True))
                                
                                submit_btn = gr.Button("🔍 Assess My Risk", variant="primary")
                    
                    # Right Column - Results
                    with gr.Column(scale=3):
                        gr.Markdown("### 📊 Your Assessment")
                        patient_output_tabs = gr.Tabs(visible=False)
                        with patient_output_tabs:
                            with gr.TabItem("📊 Risk Assessment"):
                                risk_output = gr.Markdown(elem_classes=["tab-content"])
                            with gr.TabItem("🔍 Detailed Analysis"):
                                detailed_analysis = gr.Markdown(elem_classes=["tab-content"])
                            with gr.TabItem("💡 Recommendations"):
                                recommendations = gr.Markdown(elem_classes=["tab-content"])
                        
                        # This message appears if a case is flagged
                        hitl_message_output = gr.Markdown(visible=False, elem_classes=["tab-content", "risk-moderate"])
                
                gr.Markdown("---")
                gr.Markdown("### 📝 Check Your Case Status")
                with gr.Row():
                    case_id_input = gr.Textbox(label="Enter Your Case ID", placeholder="e.g., 1001", scale=3)
                    check_status_btn = gr.Button("🔍 Check Status", variant="secondary", scale=1)
                status_output = gr.Markdown(label="Case Status")

            # --- TAB 2: DOCTOR DASHBOARD ---
            with gr.TabItem("🩺 Doctor Dashboard (Human-in-the-Loop)", elem_classes=["tab-content"]):
                gr.Markdown("## 👩‍⚕️ Pending Case Review")
                gr.Markdown("This dashboard allows a medical professional to review cases flagged by the AI agent.")
                
                refresh_btn = gr.Button("🔄 Refresh Pending Cases", variant="primary")
                with gr.Row():
                    pending_cases_df = gr.DataFrame(
                        headers=["Case ID", "Risk", "Symptoms", "AI Analysis"],
                        label="Cases Flagged for Human Review",
                        datatype=["str", "str", "str", "str"],
                        wrap=True,
                        interactive=False
                    )
                
                gr.Markdown("---")
                gr.Markdown("### 🖊️ Submit Your Review")
                with gr.Row():
                    with gr.Column():
                        review_case_id = gr.Textbox(label="Case ID to Review", placeholder="Enter Case ID from table")
                        final_decision = gr.Radio(
                            ["Approve AI Analysis", "Override Analysis"],
                            label="Final Decision"
                        )
                    doctor_notes = gr.Textbox(
                        label="Doctor's Notes (Required)",
                        placeholder="e.g., The AI's analysis is correct, but I would also add a recommendation for...",
                        lines=5
                    )
                
                submit_review_btn = gr.Button("Submit & Close Case", variant="primary")
                doctor_submit_output = gr.Markdown()


        # --- 6. Event Handlers ---

        # Patient Portal: Submit Symptoms
        def process_symptoms(*symptoms_bools):
            present_symptoms = [SYMPTOMS[i] for i, present in enumerate(symptoms_bools) if present]
            
            if not present_symptoms:
                risk_html = "<div class='risk-card risk-low'><h2>Risk Level: <strong>LOW</strong></h2><p>No symptoms were selected. Based on this, the risk is low.</p></div>"
                return risk_html, "## No Symptoms", "## No Symptoms", False, gr.Markdown(visible=False)

            # Call the agent
            ai_response = agent.triage_symptoms_agentic(present_symptoms)
            
            # Agent decides what to do
            if ai_response["action"] == "PROVIDE_INFO_ONLY":
                # AI handles it, no HITL
                risk_html = f"<div class='risk-card risk-low'><h2>Risk Level: <strong>LOW</strong></h2><p>{RISK_LEVELS['LOW']}</p></div>"
                analysis_html = f"## 🔍 Detailed Analysis\n\n{ai_response['analysis']}"
                recs_html = f"## 💡 Recommendations\n\n{ai_response['recommendations']}"
                
                return risk_html, analysis_html, recs_html, gr.Tabs(visible=True), gr.Markdown(visible=False)
            
            elif ai_response["action"] == "FLAG_FOR_REVIEW":
                # AI flags for HITL
                case_id = create_case_in_db(present_symptoms, ai_response)
                
                hitl_message = f"""
                <div class='risk-card risk-moderate'>
                    <h2>Risk Level: <strong>{ai_response['risk_level']} (Pending Review)</strong></h2>
                    <p>Based on your symptoms, our AI has flagged your case for review by a qualified medical professional.</p>
                    <p>This is a free service, and your review will be completed anonymously.</p>
                    <hr>
                    <h3>Your Case ID is: <strong>{case_id}</strong></h3>
                    <p>Please save this ID. You can use it on this page to check the status of your review.</p>
                </div>
                """
                return "", "", "", gr.Tabs(visible=False), gr.Markdown(value=hitl_message, visible=True)
            
            return "", "", "", False, gr.Markdown(value="Error: Unknown AI action", visible=True)

        submit_btn.click(
            fn=process_symptoms,
            inputs=inputs,
            outputs=[risk_output, detailed_analysis, recommendations, patient_output_tabs, hitl_message_output]
        )

        # Patient Portal: Check Status
        check_status_btn.click(
            fn=get_case_status_from_db,
            inputs=[case_id_input],
            outputs=[status_output]
        )

        # Doctor Dashboard: Refresh
        refresh_btn.click(
            fn=get_pending_cases_from_db,
            inputs=[],
            outputs=[pending_cases_df]
        )
        
        # Doctor Dashboard: Submit Review
        submit_review_btn.click(
            fn=complete_case_review_in_db,
            inputs=[review_case_id, final_decision, doctor_notes],
            outputs=[doctor_submit_output]
        )

        # Add footer with disclaimer (applies to all tabs)
        gr.Markdown("""
        ### ℹ️ Important Disclaimer
        This AI-powered tool is for **informational purposes only** and is not a substitute for professional medical advice, 
        diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider.
        """)
    
    return demo

if __name__ == "__main__":
    # Create and launch the interface
    demo = create_interface()
    demo.launch(share=False, server_name="0.0.0.0")
