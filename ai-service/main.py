"""
LUCI AI Service - Servicio de IA para Agente Aduanero
Powered by Claude Sonnet 4 & Claude Opus 4.5
"""

import os
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from services.claude_service import ClaudeService
from services.document_service import DocumentService
from services.classification_service import ClassificationService
from services.knowledge_service import KnowledgeService

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize services
claude_service = ClaudeService()
document_service = DocumentService()
classification_service = ClassificationService()
knowledge_service = KnowledgeService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("LUCI AI Service starting...")
    yield
    logger.info("LUCI AI Service shutting down...")


# Create FastAPI app
app = FastAPI(
    title="LUCI AI Service",
    description="Servicio de IA para el Agente Aduanero Inteligente LUCI",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== Models ==============

class ChatRequest(BaseModel):
    message: str
    expedition_context: Optional[Dict[str, Any]] = None
    conversation_history: Optional[List[Dict[str, str]]] = None
    context_type: str = "client"  # "client" or "agent"


class ChatResponse(BaseModel):
    message: str
    model: str
    tokens_used: int
    confidence: float
    sources: List[str] = []


class ClassificationRequest(BaseModel):
    description: str
    additional_info: Optional[Dict[str, Any]] = None
    language: str = "es"


class ClassificationResponse(BaseModel):
    suggestions: List[Dict[str, Any]]
    warnings: List[str] = []
    additional_info_needed: List[str] = []


class DocumentValidationRequest(BaseModel):
    document_type: str
    document_content: Optional[str] = None  # Base64 or extracted text
    file_path: Optional[str] = None
    expedition_context: Optional[Dict[str, Any]] = None


class DocumentValidationResponse(BaseModel):
    is_valid: bool
    confidence: float
    extracted_data: Dict[str, Any]
    issues: List[str] = []
    warnings: List[str] = []
    auto_fill_suggestions: Dict[str, Any] = {}


class H1GenerationRequest(BaseModel):
    expedition: Dict[str, Any]
    regime: str = "40"
    additional_procedure: str = "000"
    preference: str = "100"


class H1GenerationResponse(BaseModel):
    declaration_data: Dict[str, Any]
    warnings: List[str] = []
    recommendations: List[str] = []


# ============== Health Check ==============

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "LUCI AI Service",
        "version": "1.0.0",
        "claude_configured": claude_service.is_configured()
    }


# ============== Chat Endpoints ==============

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat with LUCI - AI assistant for customs queries
    Uses Claude Sonnet 4 for fast responses
    """
    try:
        response = await claude_service.chat(
            message=request.message,
            expedition_context=request.expedition_context,
            conversation_history=request.conversation_history,
            context_type=request.context_type
        )
        return ChatResponse(**response)
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ask")
async def ask_luci(question: str):
    """
    Ask LUCI a general customs question
    """
    try:
        response = await claude_service.ask(question)
        return response
    except Exception as e:
        logger.error(f"Ask error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Classification Endpoints ==============

@app.post("/classify", response_model=ClassificationResponse)
async def classify_product(request: ClassificationRequest):
    """
    Suggest TARIC codes for a product description
    Uses Claude Opus 4.5 for complex reasoning
    """
    try:
        response = await classification_service.classify(
            description=request.description,
            additional_info=request.additional_info,
            language=request.language
        )
        return ClassificationResponse(**response)
    except Exception as e:
        logger.error(f"Classification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/validate-classification")
async def validate_classification(
    taric_code: str,
    description: str,
    origin: str = None
):
    """
    Validate if a TARIC code is appropriate for the product
    """
    try:
        response = await classification_service.validate(
            taric_code=taric_code,
            description=description,
            origin=origin
        )
        return response
    except Exception as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Document Endpoints ==============

@app.post("/validate-document", response_model=DocumentValidationResponse)
async def validate_document(request: DocumentValidationRequest):
    """
    Validate and extract data from a customs document
    Uses OCR + Claude Vision for document understanding
    """
    try:
        response = await document_service.validate(
            document_type=request.document_type,
            document_content=request.document_content,
            file_path=request.file_path,
            expedition_context=request.expedition_context
        )
        return DocumentValidationResponse(**response)
    except Exception as e:
        logger.error(f"Document validation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/extract-document")
async def extract_document_data(
    document_type: str,
    file_path: str = None,
    content: str = None
):
    """
    Extract structured data from a document
    """
    try:
        response = await document_service.extract(
            document_type=document_type,
            file_path=file_path,
            content=content
        )
        return response
    except Exception as e:
        logger.error(f"Extraction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Declaration Generation ==============

@app.post("/generate-h1", response_model=H1GenerationResponse)
async def generate_h1(request: H1GenerationRequest):
    """
    Generate H1 import declaration data using AI
    Uses Claude Opus 4.5 for complex form filling
    """
    try:
        response = await claude_service.generate_h1(
            expedition=request.expedition,
            regime=request.regime,
            additional_procedure=request.additional_procedure,
            preference=request.preference
        )
        return H1GenerationResponse(**response)
    except Exception as e:
        logger.error(f"H1 generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-aes")
async def generate_aes(expedition: Dict[str, Any], export_type: str = "10"):
    """
    Generate AES export declaration data
    """
    try:
        response = await claude_service.generate_aes(
            expedition=expedition,
            export_type=export_type
        )
        return response
    except Exception as e:
        logger.error(f"AES generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Calculation Endpoints ==============

@app.post("/calculate-duties")
async def calculate_duties(
    taric_code: str,
    value: float,
    origin: str,
    preference: str = "100"
):
    """
    Calculate customs duties for a product
    """
    try:
        # This would integrate with TARIC database
        response = await classification_service.calculate_duties(
            taric_code=taric_code,
            value=value,
            origin=origin,
            preference=preference
        )
        return response
    except Exception as e:
        logger.error(f"Calculation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Knowledge Base ==============

@app.get("/knowledge/search")
async def search_knowledge(query: str, limit: int = 5):
    """
    Search the customs knowledge base
    """
    try:
        response = knowledge_service.search(query, limit=limit)
        return response
    except Exception as e:
        logger.error(f"Knowledge search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/knowledge/categories")
async def get_knowledge_categories():
    """
    Get all knowledge base categories
    """
    return knowledge_service.get_categories()


@app.get("/knowledge/h1-guidance/{field}")
async def get_h1_field_guidance(field: str):
    """
    Get guidance for completing a specific H1 field
    """
    return knowledge_service.get_h1_guidance(field)


@app.get("/knowledge/document-requirements")
async def get_document_requirements(
    operation_type: str,
    transport_mode: str,
    origin_country: str,
    product_type: Optional[str] = None
):
    """
    Get document requirements for an operation
    """
    return knowledge_service.get_document_requirements(
        operation_type=operation_type,
        transport_mode=transport_mode,
        origin_country=origin_country,
        product_type=product_type
    )


@app.get("/knowledge/regime/{regime_code}")
async def get_regime_info(regime_code: str):
    """
    Get detailed information about a customs regime
    """
    return knowledge_service.get_regime_info(regime_code)


@app.get("/knowledge/incoterm/{incoterm}")
async def get_incoterm_info(incoterm: str):
    """
    Get Incoterm information and customs value adjustments
    """
    return knowledge_service.get_incoterm_info(incoterm)


@app.get("/knowledge/documents")
async def list_training_documents():
    """
    List available FIGAD training documents
    """
    return knowledge_service.list_available_documents()


# ============== Run Server ==============

if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8003))
    debug = os.getenv("DEBUG", "false").lower() == "true"

    logger.info(f"Starting LUCI AI Service on {host}:{port}")

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info"
    )
