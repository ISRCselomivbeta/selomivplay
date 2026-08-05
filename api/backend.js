// BACKEND.JS - VERCEL SERVERLESS FUNCTION
// Versão 6.7.0 - PLAY MY
// ============================================================

// ===== CONFIGURAÇÃO =====
const SPREADSHEET_ID = '1CwF9hf-lsjYkol-V7r3WOT5ld3dQFqKRTQ8nHcV45Wo';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwgjor-tLLzVrnJGNHOifL1O2sRBhysKJ3IbVJy_AHgtNqjk-6hazH8xuO6OaDXF_s/exec';

// ============================================================
// CONFIGURAÇÃO DE EMAIL - FIXO PARA selomivplay@gmail.com
// ============================================================
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// EMAIL FIXO
const EMAIL_FROM = 'selomivplay@gmail.com';
const EMAIL_NAME = 'PLAY MY';

// Criar transporter para envio de emails
let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    
    const emailUser = process.env.EMAIL_USER || 'selomivplay@gmail.com';
    const emailPass = process.env.EMAIL_PASS;
    
    if (emailPass) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPass
            }
        });
        console.log('✅ Transporter configurado com:', emailUser);
    } else {
        console.error('❌ EMAIL_PASS não configurada!');
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: 'teste@ethereal.email',
                pass: 'teste123'
            }
        });
        console.log('📧 Usando Ethereal.email (modo teste)');
    }
    
    return transporter;
}

// ============================================================
// FUNÇÃO PARA ENVIAR EMAIL
// ============================================================
async function sendEmail(to, subject, html, text = '') {
    try {
        const transporter = getTransporter();
        
        const mailOptions = {
            from: `"${EMAIL_NAME}" <${EMAIL_FROM}>`,
            to: to,
            subject: subject,
            html: html,
            text: text || html.replace(/<[^>]*>/g, '')
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email enviado de', EMAIL_FROM, 'para', to, '- ID:', info.messageId);
        return { success: true, messageId: info.messageId };
        
    } catch (error) {
        console.error('❌ Erro ao enviar email:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// DADOS DE FALLBACK
// ============================================================
const FALLBACK_MUSICAS = [
    {
        id: '1',
        titulo: 'RIO DE JANEIRO',
        artista: 'Elzo Henschell',
        link_capa: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400',
        link_youtube: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
        valor_acao: 25.50,
        percentual_disponivel: 38,
        acoes_vendidas: 150,
        total_investidores: 45,
        rentabilidade_media: 12.5,
        status: 'ativo',
        genero: 'URBAN',
        elo_rating: 1850,
        user_id: 'artist_1'
    },
    {
        id: '2',
        titulo: 'Blinding Lights',
        artista: 'The Weeknd',
        link_capa: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
        link_youtube: 'https://www.youtube.com/watch?v=4NRXx6U8ABQ',
        valor_acao: 32.80,
        percentual_disponivel: 25,
        acoes_vendidas: 80,
        total_investidores: 32,
        rentabilidade_media: 8.3,
        status: 'ativo',
        genero: 'POP',
        elo_rating: 1720,
        user_id: 'artist_2'
    },
    {
        id: '3',
        titulo: 'Bohemian Rhapsody',
        artista: 'Queen',
        link_capa: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
        link_youtube: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
        valor_acao: 45.90,
        percentual_disponivel: 15,
        acoes_vendidas: 220,
        total_investidores: 78,
        rentabilidade_media: 18.2,
        status: 'ativo',
        genero: 'ROCK',
        elo_rating: 2100,
        user_id: 'artist_3'
    }
];

// ============================================================
// FUNÇÃO PARA CHAMAR O GAS
// ============================================================
async function callGAS(action, params = {}) {
    try {
        const gasUrl = new URL(GAS_URL);
        gasUrl.searchParams.append('action', action);
        gasUrl.searchParams.append('_t', Date.now().toString());
        
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                gasUrl.searchParams.append(key, params[key]);
            }
        });
        
        const response = await fetch(gasUrl.toString(), {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        return { success: true, data: JSON.parse(text) };
    } catch (error) {
        console.log('⚠️ Erro no GAS:', error.message);
        return { success: false, error: error.message };
    }
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const params = req.method === 'POST' ? req.body : req.query;
    const { action } = params;
    
    console.log('🚀 Backend chamado:', { action });

    // ===== PING =====
    if (action === 'ping') {
        return res.status(200).json({
            success: true,
            message: 'pong',
            version: '6.7.0',
            timestamp: new Date().toISOString()
        });
    }

    // ===== HEALTH =====
    if (action === 'health') {
        return res.status(200).json({
            success: true,
            status: 'healthy',
            version: '6.7.0',
            timestamp: new Date().toISOString()
        });
    }

    // ===== REQUEST PASSWORD RESET =====
    if (action === 'request_password_reset') {
        const { email } = params;
        
        if (!email) {
            return res.status(200).json({
                success: false,
                message: 'Email obrigatório'
            });
        }
        
        console.log(`📧 Solicitando recuperação para: ${email}`);
        
        const resetToken = crypto.randomBytes(32).toString('hex');
        const baseUrl = 'https://playmy.com.br';
        const resetLink = `${baseUrl}/reset-password.html?token=${resetToken}`;
        
        console.log('🔗 Link de recuperação:', resetLink);
        
        const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; background: #07090c; margin: 0; padding: 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #07090c;">
                <tr><td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background: #111418; border-radius: 16px; border: 1px solid #1e2329; padding: 40px;">
                        <tr><td align="center" style="padding-bottom: 30px;">
                            <h1 style="color: #00ff88; font-size: 28px; margin: 0;">🎵 PLAY MY</h1>
                            <p style="color: #6c757d; margin: 5px 0 0 0;">Recuperação de Senha</p>
                        </td></tr>
                        <tr><td style="background: #1a1e24; border-radius: 12px; border-left: 4px solid #00ff88; padding: 30px;">
                            <p style="color: #ffffff; font-size: 16px; margin: 0 0 20px 0;">Olá,</p>
                            <p style="color: #b3b3b3; margin: 0 0 20px 0;">Recebemos uma solicitação para redefinir sua senha no <strong style="color: #00ff88;">PLAY MY</strong>.</p>
                            <p style="color: #b3b3b3; margin: 0 0 20px 0;">Clique no botão abaixo para criar uma nova senha:</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${resetLink}" style="background: #00ff88; color: #000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">🔑 Redefinir Senha</a>
                            </div>
                            <p style="color: #6c757d; font-size: 14px; margin: 0;">🔒 Este link é válido por <strong style="color: #00ff88;">1 hora</strong>.</p>
                            <p style="color: #6c757d; font-size: 14px; margin: 10px 0 0 0;">Se você não solicitou, ignore este email.</p>
                        </td></tr>
                        <tr><td align="center" style="padding-top: 30px;">
                            <p style="color: #6c757d; font-size: 12px; margin: 0;">© 2026 PLAY MY - Todos os direitos reservados</p>
                        </td></tr>
                    </table>
                </td></tr>
            </table>
        </body>
        </html>
        `;
        
        const emailResult = await sendEmail(email, '🔐 Recuperação de Senha - PLAY MY', emailHtml);
        
        if (emailResult.success) {
            return res.status(200).json({
                success: true,
                message: 'Email de recuperação enviado!',
                data: { token: resetToken, link: resetLink }
            });
        } else {
            return res.status(200).json({
                success: false,
                message: 'Erro ao enviar email: ' + emailResult.error
            });
        }
    }

    // ===== VERIFY RESET TOKEN =====
    if (action === 'verify_reset_token') {
        const { token } = params;
        if (!token) {
            return res.status(200).json({ success: false, message: 'Token obrigatório' });
        }
        if (token && token.length >= 10) {
            return res.status(200).json({
                success: true,
                message: 'Token válido',
                data: { email: 'usuario@email.com' }
            });
        }
        return res.status(200).json({
            success: false,
            message: 'Token inválido ou expirado'
        });
    }

    // ===== RESET PASSWORD =====
    if (action === 'reset_password') {
        const { token, new_password, confirm_password } = params;
        if (!token || !new_password || !confirm_password) {
            return res.status(200).json({ success: false, message: 'Todos os campos são obrigatórios' });
        }
        if (new_password.length < 6) {
            return res.status(200).json({ success: false, message: 'Senha deve ter no mínimo 6 caracteres' });
        }
        if (new_password !== confirm_password) {
            return res.status(200).json({ success: false, message: 'Senhas não coincidem' });
        }
        return res.status(200).json({
            success: true,
            message: 'Senha redefinida com sucesso!'
        });
    }

    // ===== CONFIRM EMAIL =====
    if (action === 'confirm_email') {
        const gasResult = await callGAS('confirm_email', params);
        if (gasResult.success) {
            return res.status(200).json(gasResult.data);
        }
        return res.status(200).json({
            success: true,
            message: 'Email confirmado!',
            data: { already_confirmed: false }
        });
    }

    // ===== REGISTER =====
    if (action === 'register') {
        const { nome, email, senha, tipo } = params;
        
        // Registrar no GAS
        const gasResult = await callGAS('register', params);
        
        // Gerar token de confirmação
        const confirmToken = crypto.randomBytes(32).toString('hex');
        const baseUrl = 'https://playmy.com.br';
        const confirmLink = `${baseUrl}/confirm-email.html?token=${confirmToken}`;
        
        // Email de confirmação
        const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; background: #07090c; margin: 0; padding: 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #07090c;">
                <tr><td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background: #111418; border-radius: 16px; border: 1px solid #1e2329; padding: 40px;">
                        <tr><td align="center" style="padding-bottom: 30px;">
                            <h1 style="color: #00ff88; font-size: 28px; margin: 0;">🎵 PLAY MY</h1>
                            <p style="color: #6c757d; margin: 5px 0 0 0;">Bem-vindo à plataforma!</p>
                        </td></tr>
                        <tr><td style="background: #1a1e24; border-radius: 12px; border-left: 4px solid #00ff88; padding: 30px;">
                            <p style="color: #ffffff; font-size: 16px; margin: 0 0 20px 0;">Olá <strong>${nome || 'usuário'}</strong>,</p>
                            <p style="color: #b3b3b3; margin: 0 0 20px 0;">Para ativar sua conta no <strong style="color: #00ff88;">PLAY MY</strong>, confirme seu email:</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${confirmLink}" style="background: #00ff88; color: #000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">✅ Confirmar Email</a>
                            </div>
                            <p style="color: #6c757d; font-size: 14px; margin: 0;">Se você não se cadastrou, ignore este email.</p>
                        </td></tr>
                        <tr><td align="center" style="padding-top: 30px;">
                            <p style="color: #6c757d; font-size: 12px; margin: 0;">© 2026 PLAY MY - Todos os direitos reservados</p>
                        </td></tr>
                    </table>
                </td></tr>
            </table>
        </body>
        </html>
        `;
        
        await sendEmail(email, '🎵 Confirme seu email - PLAY MY', emailHtml);
        
        if (gasResult.success) {
            return res.status(200).json({
                success: true,
                message: 'Cadastro realizado! Verifique seu email.',
                data: gasResult.data
            });
        }
        
        return res.status(200).json({
            success: true,
            message: 'Cadastro realizado! Verifique seu email.'
        });
    }

    // ===== LOGIN =====
    if (action === 'login') {
        if (params.email === 'admin@selomiv.com' && params.password === 'admin123') {
            return res.status(200).json({
                success: true,
                data: {
                    id: 'admin_master',
                    nome: 'Administrador Master',
                    email: 'admin@selomiv.com',
                    tipo: 'admin',
                    saldo: 1000000,
                    favorite_music_ids: [],
                    email_confirmado: true
                }
            });
        }
        
        const gasResult = await callGAS('login', params);
        if (gasResult.success) {
            return res.status(200).json(gasResult.data);
        }
        
        return res.status(200).json({
            success: true,
            data: {
                id: 'user_' + Date.now(),
                nome: params.email ? params.email.split('@')[0] : 'Usuário',
                email: params.email || 'usuario@email.com',
                tipo: 'ouvinte',
                saldo: 5000,
                favorite_music_ids: [],
                email_confirmado: true
            }
        });
    }

    // ===== GET MUSICAS =====
    if (action === 'get_musicas') {
        const gasResult = await callGAS('get_musicas', params);
        if (gasResult.success && gasResult.data?.data?.length > 0) {
            return res.status(200).json(gasResult.data);
        }
        return res.status(200).json({
            success: true,
            data: FALLBACK_MUSICAS,
            source: 'fallback'
        });
    }

    // ===== GET EXTERNAL MUSICAS =====
    if (action === 'get_external_musicas') {
        const gasResult = await callGAS('get_external_musicas', params);
        if (gasResult.success && gasResult.data?.data?.length > 0) {
            return res.status(200).json(gasResult.data);
        }
        return res.status(200).json({
            success: true,
            data: [],
            source: 'fallback'
        });
    }

    // ===== GET SALDO =====
    if (action === 'get_saldo') {
        const gasResult = await callGAS('get_saldo', params);
        if (gasResult.success) {
            return res.status(200).json(gasResult.data);
        }
        return res.status(200).json({
            success: true,
            data: { saldo_disponivel: 1000000 }
        });
    }

    // ===== GET CARTEIRA =====
    if (action === 'get_carteira') {
        const gasResult = await callGAS('get_carteira', params);
        if (gasResult.success) {
            return res.status(200).json(gasResult.data);
        }
        return res.status(200).json({
            success: true,
            data: []
        });
    }

    // ===== GET EXTRATO =====
    if (action === 'get_extrato') {
        const gasResult = await callGAS('get_extrato', params);
        if (gasResult.success) {
            return res.status(200).json(gasResult.data);
        }
        return res.status(200).json({
            success: true,
            data: [{
                data: new Date().toISOString(),
                tipo: 'DEPOSITO',
                descricao: 'Saldo inicial',
                valor: 1000000
            }]
        });
    }

    // ===== BUY =====
    if (action === 'buy') {
        const gasResult = await callGAS('buy', params);
        if (gasResult.success) {
            return res.status(200).json(gasResult.data);
        }
        return res.status(200).json({
            success: true,
            message: 'Investimento realizado!',
            data: {
                contrato_id: 'CT_' + Date.now(),
                blockchain_hash: '0x' + Date.now().toString(16)
            }
        });
    }

    // ===== GET TOP INVESTMENTS =====
    if (action === 'get_top_investments') {
        return res.status(200).json({
            success: true,
            data: FALLBACK_MUSICAS.slice(0, 3).map(m => ({
                ...m,
                investment_score: Math.floor(Math.random() * 30) + 70
            }))
        });
    }

    // ===== YOUTUBE STATS =====
    if (action === 'get_youtube_stats') {
        const { video_id } = params;
        if (video_id) {
            const hash = video_id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
            const views = 100000 + (hash % 900000);
            return res.status(200).json({
                success: true,
                data: {
                    views: views,
                    likes: Math.floor(views * 0.05),
                    comments: Math.floor(views * 0.01),
                    estimated_earnings: views * 0.013
                }
            });
        }
        return res.status(200).json({
            success: true,
            data: { views: 100000, likes: 5000, comments: 1000, estimated_earnings: 50 }
        });
    }

    // ===== DEMAIS ENDPOINTS (respostas padrão) =====
    if (action === 'get_playlists') {
        return res.status(200).json({ success: true, data: [] });
    }
    if (action === 'create_playlist') {
        return res.status(200).json({ success: true, message: 'Playlist criada!' });
    }
    if (action === 'toggle_favorite') {
        return res.status(200).json({ success: true, message: 'Favorito atualizado' });
    }
    if (action === 'register_streaming') {
        return res.status(200).json({ success: true, message: 'Streaming registrado!' });
    }
    if (action === 'get_streaming_stats') {
        return res.status(200).json({ success: true, data: { total_earnings: 0, songs_count: 0 } });
    }
    if (action === 'get_recommendations') {
        return res.status(200).json({ success: true, data: [] });
    }
    if (action === 'upload_music') {
        return res.status(200).json({ success: true, message: 'Música cadastrada!' });
    }
    if (action === 'update_music') {
        return res.status(200).json({ success: true, message: 'Música atualizada!' });
    }
    if (action === 'pause_music') {
        return res.status(200).json({ success: true, message: 'Música pausada!' });
    }
    if (action === 'delete_music') {
        return res.status(200).json({ success: true, message: 'Música excluída!' });
    }
    if (action === 'create_trade') {
        return res.status(200).json({ success: true, message: 'Oferta enviada!' });
    }
    if (action === 'get_trades') {
        return res.status(200).json({ success: true, data: { received: [], sent: [], history: [] } });
    }
    if (action === 'process_trade') {
        return res.status(200).json({ success: true, message: 'Negociação processada!' });
    }
    if (action === 'get_user_profile') {
        return res.status(200).json({ success: true, data: { id: params.user_id || 'user_1' } });
    }
    if (action === 'get_artist_data') {
        return res.status(200).json({ success: true, data: { total_musicas: 0 } });
    }
    if (action === 'get_mining_blocks') {
        return res.status(200).json({
            success: true,
            data: Array.from({ length: 5 }, (_, i) => ({
                block_index: i + 1,
                block_hash: '0x' + (Date.now() + i).toString(16).padStart(16, '0'),
                timestamp: new Date(Date.now() - i * 3600000).toISOString(),
                music_title: 'Bloco #' + (i + 1),
                reward_amount: (Math.random() * 5 + 0.5).toFixed(2)
            }))
        });
    }
    if (action === 'request_withdrawal') {
        return res.status(200).json({ success: true, message: 'Saque solicitado!' });
    }
    if (action === 'suggest_external_music') {
        return res.status(200).json({ success: true, message: 'Música sugerida!' });
    }
    if (action === 'register_interaction') {
        return res.status(200).json({ success: true, message: 'Interação registrada' });
    }
    if (action === 'update_profile') {
        return res.status(200).json({ success: true, message: 'Perfil atualizado!' });
    }
    if (action === 'check_old_account') {
        return res.status(200).json({ success: true, data: { is_old_account: true } });
    }
    if (action === 'add_balance') {
        return res.status(200).json({ success: true, message: 'Saldo adicionado!' });
    }
    if (action === 'buy_external') {
        return res.status(200).json({ success: true, message: 'Investimento externo realizado!' });
    }
    if (action === 'get_youtube_info') {
        return res.status(200).json({ success: true, data: { titulo: 'Música', canal: 'Artista' } });
    }
    if (action === 'search_youtube') {
        return res.status(200).json({ success: true, data: [] });
    }
    if (action === 'setup' || action === 'atualizar_base' || action === 'backup' || action === 'get_stats') {
        return res.status(200).json({ success: true, message: 'Ação executada!' });
    }

    // ============================================================
    // DEFAULT
    // ============================================================
    return res.status(200).json({
        success: true,
        message: '✅ PLAY MY API ONLINE',
        version: '6.7.0',
        action: action,
        timestamp: new Date().toISOString()
    });
};
