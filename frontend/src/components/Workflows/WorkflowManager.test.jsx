import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import WorkflowManager from './WorkflowManager';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}));

describe('WorkflowManager', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    global.fetch = vi.fn();
    window.confirm = vi.fn(() => true);
  });

  // ==================== INITIAL LOAD ====================
  test('shows loading spinner initially', () => {
    global.fetch.mockImplementation(() => new Promise(() => {}));
    render(<WorkflowManager />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  test('loads workflows and stats on mount', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/workflows/stats')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              workflows: { totalWorkflows: 10, activeWorkflows: 7 },
              executions: { total: 100, completed: 90, failed: 10 },
              running: 2
            }
          })
        });
      }
      if (url.includes('/workflows/templates')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      if (url.includes('/workflows/events')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      if (url.includes('/workflows/actions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      // main workflows endpoint
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              _id: 'wf1',
              name: 'Import Workflow',
              description: 'Handles imports',
              category: 'import',
              status: 'active',
              enabled: true,
              stats: { totalExecutions: 50 }
            }
          ]
        })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('Import Workflow')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('Handles imports')).toBeInTheDocument();
    });
  });

  test('shows error message on fetch failure', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  test('closes error message when clicking Cerrar', async () => {
    const user = userEvent.setup();
    global.fetch.mockRejectedValue(new Error('Network error'));

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cerrar'));

    expect(screen.queryByText('Network error')).not.toBeInTheDocument();
  });

  // ==================== WORKFLOW LIST ====================
  test('renders empty state when no workflows', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: null })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('No hay workflows configurados')).toBeInTheDocument();
    });
  });

  test('renders multiple workflows with different categories', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                _id: 'wf1',
                name: 'Import Workflow',
                category: 'import',
                status: 'active',
                enabled: true,
                stats: { totalExecutions: 10 }
              },
              {
                _id: 'wf2',
                name: 'Export Workflow',
                category: 'export',
                status: 'draft',
                enabled: false,
                stats: { totalExecutions: 0 }
              },
              {
                _id: 'wf3',
                name: 'Transit Workflow',
                category: 'transit',
                status: 'paused',
                enabled: true,
                stats: { totalExecutions: 5 }
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: null })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('Import Workflow')).toBeInTheDocument();
    });
    expect(screen.getByText('Export Workflow')).toBeInTheDocument();
    expect(screen.getByText('Transit Workflow')).toBeInTheDocument();
  });

  test('displays category icons correctly', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                _id: 'wf1',
                name: 'Import',
                category: 'import',
                status: 'active',
                enabled: true,
                stats: { totalExecutions: 0 }
              },
              {
                _id: 'wf2',
                name: 'Notification',
                category: 'notification',
                status: 'active',
                enabled: true,
                stats: { totalExecutions: 0 }
              },
              {
                _id: 'wf3',
                name: 'Unknown',
                category: 'unknown',
                status: 'active',
                enabled: true,
                stats: { totalExecutions: 0 }
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: null })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('Import')).toBeInTheDocument();
    });
    // Icons should be rendered as emoji text
    const listItems = screen.getAllByRole('listitem');
    expect(listItems[0]).toHaveTextContent('📦');
    expect(listItems[1]).toHaveTextContent('🔔');
    expect(listItems[2]).toHaveTextContent('📄'); // fallback for unknown
  });

  test('displays status badges with correct colors', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                _id: 'wf1',
                name: 'Active',
                category: 'custom',
                status: 'active',
                enabled: true,
                stats: { totalExecutions: 0 }
              },
              {
                _id: 'wf2',
                name: 'Draft',
                category: 'custom',
                status: 'draft',
                enabled: false,
                stats: { totalExecutions: 0 }
              },
              {
                _id: 'wf3',
                name: 'Paused',
                category: 'custom',
                status: 'paused',
                enabled: true,
                stats: { totalExecutions: 0 }
              },
              {
                _id: 'wf4',
                name: 'Archived',
                category: 'custom',
                status: 'archived',
                enabled: false,
                stats: { totalExecutions: 0 }
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: null })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('active')).toHaveClass('bg-green-100', 'text-green-800');
    });
    expect(screen.getByText('draft')).toHaveClass('bg-gray-100', 'text-gray-800');
    expect(screen.getByText('paused')).toHaveClass('bg-yellow-100', 'text-yellow-800');
    expect(screen.getByText('archived')).toHaveClass('bg-red-100', 'text-red-800');
  });

  test('shows "Sin descripcion" when description is missing', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                _id: 'wf1',
                name: 'No Description',
                category: 'custom',
                status: 'active',
                enabled: true,
                stats: { totalExecutions: 0 }
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: null })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('Sin descripcion')).toBeInTheDocument();
    });
  });

  test('displays execution count with fallback to 0', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                _id: 'wf1',
                name: 'With Stats',
                category: 'custom',
                status: 'active',
                enabled: true,
                stats: { totalExecutions: 25 }
              },
              {
                _id: 'wf2',
                name: 'No Stats',
                category: 'custom',
                status: 'active',
                enabled: true
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: null })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('25 ejecuciones')).toBeInTheDocument();
    });
    expect(screen.getByText('0 ejecuciones')).toBeInTheDocument();
  });

  // ==================== WORKFLOW STATS ====================
  test('renders workflow stats with correct values', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/workflows/stats')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              workflows: { totalWorkflows: 15, activeWorkflows: 10 },
              executions: { total: 200, completed: 180, failed: 20 },
              running: 3
            }
          })
        });
      }
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: null })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('Total Workflows')).toBeInTheDocument();
    });
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Activos')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Ejecuciones')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('Exitosas')).toBeInTheDocument();
    expect(screen.getByText('180')).toBeInTheDocument();
    expect(screen.getByText('Fallidas')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('En Progreso')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('handles missing nested stats gracefully with fallback to 0', async () => {
    global.fetch.mockImplementation((url) => {
      if (url.includes('/workflows/stats')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              workflows: {},
              executions: {}
            }
          })
        });
      }
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: null })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('Total Workflows')).toBeInTheDocument();
    });
    const zeroTexts = screen.getAllByText('0');
    expect(zeroTexts.length).toBeGreaterThanOrEqual(6); // All six stats should show 0
  });

  // ==================== TOGGLE ENABLED ====================
  test('toggles workflow enabled state', async () => {
    const user = userEvent.setup();
    let toggleCalled = false;

    global.fetch.mockImplementation((url, options) => {
      if (url.includes('/workflows/wf1/toggle')) {
        toggleCalled = true;
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true })
        });
      }
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                _id: 'wf1',
                name: 'Toggle Test',
                category: 'custom',
                status: 'active',
                enabled: true,
                stats: { totalExecutions: 0 }
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: null })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('Toggle Test')).toBeInTheDocument();
    });

    // Find toggle button by looking for the switch in the list item
    const toggleSwitch = document.querySelector('.bg-blue-600.rounded-full.h-6');

    await user.click(toggleSwitch);

    await waitFor(() => {
      expect(toggleCalled).toBe(true);
    }, { timeout: 2000 });
  });

  // ==================== DELETE WORKFLOW ====================
  test('deletes workflow after confirmation', async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn(() => true);
    let deleteCalled = false;

    global.fetch.mockImplementation((url, options) => {
      if (url.includes('/workflows/wf1') && options?.method === 'DELETE') {
        deleteCalled = true;
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true })
        });
      }
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                _id: 'wf1',
                name: 'To Delete',
                category: 'custom',
                status: 'active',
                enabled: true,
                stats: { totalExecutions: 0 }
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: null })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('To Delete')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button').filter(btn => {
      const svg = btn.querySelector('svg');
      return svg && svg.querySelector('path[d*="M19 7"]');
    });
    await user.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalledWith('Estas seguro de eliminar este workflow?');

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    }, { timeout: 2000 });
  });

  test('does not delete workflow if confirmation is cancelled', async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn(() => false);

    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                _id: 'wf1',
                name: 'Not Deleted',
                category: 'custom',
                status: 'active',
                enabled: true,
                stats: { totalExecutions: 0 }
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: null })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('Not Deleted')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button').filter(btn => {
      const svg = btn.querySelector('svg');
      return svg && svg.querySelector('path[d*="M19 7"]');
    });
    await user.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalled();

    // Should not call DELETE
    const deleteCalls = Array.from(global.fetch.mock.calls).filter(call =>
      call[1]?.method === 'DELETE'
    );
    expect(deleteCalls.length).toBe(0);
  });

  // ==================== WORKFLOW DETAIL MODAL ====================
  test('opens workflow detail modal when clicking workflow name', async () => {
    const user = userEvent.setup();

    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                _id: 'wf1',
                name: 'Detail Test',
                description: 'Test description',
                category: 'import',
                status: 'active',
                enabled: true,
                trigger: {
                  type: 'event',
                  event: 'declaration.created'
                },
                actions: [
                  { order: 1, name: 'Send Email', type: 'email' },
                  { order: 2, name: 'Update Status', type: 'status' }
                ],
                stats: {
                  totalExecutions: 100,
                  successfulExecutions: 95,
                  failedExecutions: 5
                }
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: null })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('Detail Test')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Detail Test'));

    await waitFor(() => {
      expect(screen.getByText('Descripcion')).toBeInTheDocument();
    });
    const descriptions = screen.getAllByText('Test description');
    expect(descriptions.length).toBeGreaterThan(0);
    expect(screen.getByText('Trigger')).toBeInTheDocument();
    expect(screen.getByText('EVENT')).toBeInTheDocument();
    expect(screen.getByText('Evento: declaration.created')).toBeInTheDocument();
    expect(screen.getByText('Acciones (2)')).toBeInTheDocument();
    expect(screen.getByText('Send Email')).toBeInTheDocument();
    expect(screen.getByText('Update Status')).toBeInTheDocument();
    expect(screen.getByText('Estadisticas')).toBeInTheDocument();
    expect(screen.getByText('95')).toBeInTheDocument(); // successful
    expect(screen.getByText('5')).toBeInTheDocument(); // failed
  });

  test('closes workflow detail modal', async () => {
    const user = userEvent.setup();

    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                _id: 'wf1',
                name: 'Modal Close Test',
                category: 'custom',
                status: 'active',
                enabled: true,
                trigger: { type: 'manual' },
                actions: [],
                stats: {}
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: null })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('Modal Close Test')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Modal Close Test'));

    await waitFor(() => {
      expect(screen.getByText('Cerrar')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cerrar'));

    await waitFor(() => {
      expect(screen.queryByText('Descripcion')).not.toBeInTheDocument();
    });
  });

  test('executes workflow from detail modal', async () => {
    const user = userEvent.setup();
    window.alert = vi.fn();

    global.fetch.mockImplementation((url) => {
      if (url.includes('/workflows/wf1/execute')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: { executionId: 'exec123' }
          })
        });
      }
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                _id: 'wf1',
                name: 'Execute Test',
                category: 'custom',
                status: 'active',
                enabled: true,
                trigger: { type: 'manual' },
                actions: [],
                stats: {}
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: null })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('Execute Test')).toBeInTheDocument();
    });

    const workflowLinks = screen.getAllByRole('button').filter(btn => btn.textContent.includes('Execute Test'));
    await user.click(workflowLinks[0]);

    await waitFor(() => {
      expect(screen.getByText('Ejecutar Ahora')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Ejecutar Ahora'));

    await waitFor(() => {
      const executeCalls = Array.from(global.fetch.mock.calls).filter(call =>
        call[0].includes('/workflows/wf1/execute')
      );
      expect(executeCalls.length).toBeGreaterThan(0);
    });

    expect(window.alert).toHaveBeenCalledWith('Workflow ejecutado: exec123');
  });

  test('displays workflow detail with schedule trigger', async () => {
    const user = userEvent.setup();

    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                _id: 'wf1',
                name: 'Scheduled',
                category: 'custom',
                status: 'active',
                enabled: true,
                trigger: {
                  type: 'schedule',
                  schedule: { cron: '0 0 * * *' }
                },
                actions: [],
                stats: {}
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: null })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('Scheduled')).toBeInTheDocument();
    });

    const workflowLinks = screen.getAllByRole('button').filter(btn => btn.textContent.includes('Scheduled'));
    await user.click(workflowLinks[0]);

    await waitFor(() => {
      expect(screen.getByText('Cron: 0 0 * * *')).toBeInTheDocument();
    });
  });

  // ==================== CREATE WORKFLOW MODAL ====================
  test('opens create workflow modal', async () => {
    const user = userEvent.setup();

    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('workflows.newWorkflow')).toBeInTheDocument();
    });

    await user.click(screen.getByText('workflows.newWorkflow'));

    await waitFor(() => {
      expect(screen.getByText('Crear Workflow')).toBeInTheDocument();
    });
    expect(screen.getByText('Elegir plantilla')).toBeInTheDocument();
  });

  test('closes create workflow modal when clicking Cancelar', async () => {
    const user = userEvent.setup();

    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('workflows.newWorkflow')).toBeInTheDocument();
    });

    await user.click(screen.getByText('workflows.newWorkflow'));

    await waitFor(() => {
      expect(screen.getByText('Cancelar')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cancelar'));

    await waitFor(() => {
      expect(screen.queryByText('Crear Workflow')).not.toBeInTheDocument();
    });
  });

  test('navigates through create workflow wizard steps', async () => {
    const user = userEvent.setup();

    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      if (url.includes('/workflows/templates')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      if (url.includes('/workflows/events')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                category: 'Declarations',
                events: [
                  { name: 'declaration.created', description: 'Declaration created' }
                ]
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('workflows.newWorkflow')).toBeInTheDocument();
    });

    await user.click(screen.getByText('workflows.newWorkflow'));

    await waitFor(() => {
      expect(screen.getByText('Empezar de cero')).toBeInTheDocument();
    });

    // Step 1 -> Step 2
    await user.click(screen.getByText('Empezar de cero'));

    await waitFor(() => {
      expect(screen.getByText('Configuracion basica')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Mi Workflow')).toBeInTheDocument();

    // Fill out form
    await user.type(screen.getByPlaceholderText('Mi Workflow'), 'Test Workflow');
    await user.type(screen.getByPlaceholderText('Descripcion del workflow...'), 'Test description');

    // Step 2 -> Step 3
    await user.click(screen.getByText('Siguiente'));

    await waitFor(() => {
      expect(screen.getByText('Revisar y crear')).toBeInTheDocument();
    });
    expect(screen.getByText('Test Workflow')).toBeInTheDocument();

    // Step 3 -> Step 2 (back)
    await user.click(screen.getByText('Atras'));

    await waitFor(() => {
      expect(screen.getByText('Configuracion basica')).toBeInTheDocument();
    });
  });

  test('creates workflow from scratch', async () => {
    const user = userEvent.setup();

    global.fetch.mockImplementation((url, options) => {
      if (url.includes('/workflows') && !url.includes('templates') && !url.includes('events') && !url.includes('actions')) {
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      if (url.includes('/workflows/events')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                category: 'Declarations',
                events: [
                  { name: 'declaration.created', description: 'Declaration created' }
                ]
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('workflows.newWorkflow')).toBeInTheDocument();
    });

    await user.click(screen.getByText('workflows.newWorkflow'));

    await waitFor(() => {
      expect(screen.getByText('Empezar de cero')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Empezar de cero'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Mi Workflow')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Mi Workflow'), 'New Workflow');
    await user.click(screen.getByText('Siguiente'));

    await waitFor(() => {
      expect(screen.getByText('Revisar y crear')).toBeInTheDocument();
    });

    const createButtons = screen.getAllByRole('button').filter(btn => btn.textContent === 'Crear Workflow');
    await user.click(createButtons[0]);

    await waitFor(() => {
      const postCalls = Array.from(global.fetch.mock.calls).filter(call =>
        call[0].includes('/workflows') && call[1]?.method === 'POST'
      );
      expect(postCalls.length).toBeGreaterThan(0);
    });
  });

  test('creates workflow from template', async () => {
    const user = userEvent.setup();

    global.fetch.mockImplementation((url, options) => {
      if (url.includes('/workflows/templates')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 'tmpl1',
                name: 'Import Template',
                description: 'Template for imports',
                category: 'import',
                trigger: { type: 'event', event: 'import.started' },
                actions: [{ order: 1, type: 'notify', name: 'Notify' }]
              }
            ]
          })
        });
      }
      if (url.includes('/workflows') && !url.includes('templates') && !url.includes('events') && !url.includes('actions')) {
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('workflows.newWorkflow')).toBeInTheDocument();
    });

    await user.click(screen.getByText('workflows.newWorkflow'));

    await waitFor(() => {
      expect(screen.getByText('Import Template')).toBeInTheDocument();
    });

    const templateButtons = screen.getAllByRole('button').filter(btn => btn.textContent.includes('Import Template'));
    await user.click(templateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Revisar y crear')).toBeInTheDocument();
    });

    const createButtons = screen.getAllByRole('button').filter(btn => btn.textContent === 'Crear Workflow');
    await user.click(createButtons[0]);

    await waitFor(() => {
      const postCalls = Array.from(global.fetch.mock.calls).filter(call =>
        call[0].includes('/workflows') && call[1]?.method === 'POST'
      );
      expect(postCalls.length).toBeGreaterThan(0);
    });
  });

  test('disables next button in step 2 when name is empty', async () => {
    const user = userEvent.setup();

    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('workflows.newWorkflow')).toBeInTheDocument();
    });

    await user.click(screen.getByText('workflows.newWorkflow'));

    await waitFor(() => {
      expect(screen.getByText('Empezar de cero')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Empezar de cero'));

    await waitFor(() => {
      const nextButton = screen.getByText('Siguiente');
      expect(nextButton).toBeDisabled();
    });
  });

  test('displays event dropdown when trigger type is event', async () => {
    const user = userEvent.setup();

    global.fetch.mockImplementation((url) => {
      if (url.includes('/workflows/events')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                category: 'Declarations',
                events: [
                  { name: 'declaration.created', description: 'New Declaration' }
                ]
              }
            ]
          })
        });
      }
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('workflows.newWorkflow')).toBeInTheDocument();
    });

    await user.click(screen.getByText('workflows.newWorkflow'));

    await waitFor(() => {
      expect(screen.getByText('Empezar de cero')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Empezar de cero'));

    await waitFor(() => {
      const labels = screen.getAllByText('Evento');
      expect(labels.length).toBeGreaterThan(0);
    });
    expect(screen.getByText('New Declaration')).toBeInTheDocument();
  });

  test('shows correct review data in step 3', async () => {
    const user = userEvent.setup();

    global.fetch.mockImplementation((url) => {
      if (url.includes('/workflows/events')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                category: 'Test',
                events: [
                  { name: 'test.event', description: 'Test Event' }
                ]
              }
            ]
          })
        });
      }
      if (url.endsWith('/workflows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
    });

    render(<WorkflowManager />);

    await waitFor(() => {
      expect(screen.getByText('workflows.newWorkflow')).toBeInTheDocument();
    });

    await user.click(screen.getByText('workflows.newWorkflow'));

    await waitFor(() => {
      expect(screen.getByText('Empezar de cero')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Empezar de cero'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Mi Workflow')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Mi Workflow'), 'Review Test');

    const categorySelect = screen.getByDisplayValue('Personalizado');
    await user.selectOptions(categorySelect, 'import');

    await user.click(screen.getByText('Siguiente'));

    await waitFor(() => {
      expect(screen.getByText('Revisar y crear')).toBeInTheDocument();
    });
    expect(screen.getByText('Review Test')).toBeInTheDocument();
    expect(screen.getAllByText('import')[0]).toBeInTheDocument();
  });
});
