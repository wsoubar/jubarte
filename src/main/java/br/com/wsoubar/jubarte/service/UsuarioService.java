package br.com.wsoubar.jubarte.service;

import java.util.List;

import br.com.wsoubar.jubarte.model.Usuario;

public interface UsuarioService {
    List<Usuario> getAllUsuarios();
    void save(Usuario usuario);
    Usuario getById(Long id);
    void deleteById(long id);   
}
